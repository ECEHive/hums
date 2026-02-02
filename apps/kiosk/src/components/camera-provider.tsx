/**
 * Camera Provider - Manages shared camera access across the kiosk app
 */

import { trpc } from "@ecehive/trpc/client";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
} from "react";
import { type CameraStatus, useCamera } from "@/hooks/use-camera";
import {
	type FaceIdMatch,
	type FaceIdStatus,
	useFaceId,
} from "@/hooks/use-face-id";
import {
	areModelsLoaded,
	captureSnapshot,
	detectFace,
	loadFaceApiModels,
} from "@/lib/face-api";

// =============================================================================
// Smart Photo Security System Configuration
// =============================================================================

/** Minimum face confidence to trigger a presence snapshot */
const MIN_PRESENCE_CONFIDENCE = 0.5;

/** Minimum face size ratio (relative to frame width) for a quality snapshot */
const MIN_PRESENCE_FACE_SIZE_RATIO = 0.05;

/**
 * Delay (ms) after face detection before sending presence snapshot.
 * During this window, if the user taps (card or Face ID), the snapshot is cancelled.
 * If no action occurs (even if face leaves frame), the snapshot is sent after this delay.
 */
const PRESENCE_SNAPSHOT_DELAY_MS = 8000;

/** Minimum interval (ms) between presence snapshots for the same tracked face */
const SAME_FACE_COOLDOWN_MS = 30000;

/**
 * Minimum interval (ms) between any presence snapshots (global rate limit).
 * This is enforced both at schedule time AND at send time to prevent race conditions.
 */
const GLOBAL_PRESENCE_COOLDOWN_MS = 10000;

/** Maximum number of presence snapshots per minute (additional rate limiting) */
const MAX_PRESENCE_SNAPSHOTS_PER_MINUTE = 4;

/**
 * Grace period (ms) after an authentication event during which presence snapshots are suppressed.
 * This prevents capturing the user immediately after they've properly authenticated.
 */
const AUTH_GRACE_PERIOD_MS = 15000;

/** Minimum face quality score (0-1) required to consider a frame for capture */
const MIN_FRAME_QUALITY_SCORE = 0.6;

// =============================================================================
// Types
// =============================================================================

/** Reason why a presence snapshot was captured */
type PresenceSnapshotReason =
	| "UNAUTHENTICATED_PRESENCE" // Face present for extended period without any authentication
	| "UNAUTHENTICATED_EXIT" // Face left frame without authenticating
	| "DELAYED_DETECTION"; // Face detected but no authentication within grace window

/** Frame quality assessment for selecting the best snapshot */
interface FrameQuality {
	score: number; // Overall quality score (0-1)
	faceSize: number; // Face size ratio
	confidence: number; // Detection confidence
	centering: number; // How centered the face is (0-1, 1 = perfect center)
	stability: number; // Movement stability score (0-1)
}

interface PendingPresenceSnapshot {
	/** Unique identifier for this pending snapshot */
	id: string;
	/** Tracked face ID that triggered this snapshot */
	faceId: string;
	/** Best captured image data (base64) - updated if better frame is found */
	imageData: string;
	/** Face detection confidence */
	confidence: number;
	/** Timestamp when the snapshot was first scheduled */
	scheduledAt: number;
	/** Timestamp of the best captured frame */
	bestFrameCapturedAt: number;
	/** Best frame quality score achieved */
	bestQualityScore: number;
	/** Face box at best frame capture */
	faceBox: { width: number; height: number; x: number; y: number };
	/** Timeout ID for the delayed send */
	timeoutId: NodeJS.Timeout;
	/** Reason for capturing this snapshot */
	reason: PresenceSnapshotReason;
	/** Number of frame updates received */
	frameUpdates: number;
}

interface CameraContextValue {
	// Camera state
	videoRef: React.RefObject<HTMLVideoElement | null>;
	cameraStatus: CameraStatus;
	cameraError: string | null;
	startCamera: () => Promise<void>;
	stopCamera: () => void;
	isCameraReady: boolean;
	cameraDimensions: { width: number; height: number } | null;
	captureDataUrl: (quality?: number) => string | null;

	// Face ID state
	faceIdStatus: FaceIdStatus;
	faceIdError: string | null;
	isFaceIdReady: boolean;
	startFaceIdScanning: () => void;
	stopFaceIdScanning: () => void;
	isFaceIdScanning: boolean;
	faceIdTrackerStats: import("@/hooks/use-face-id").TrackerStats;
	currentTrackedFace: import("@/lib/face-tracker").TrackedFace | null;

	// Face ID match handling
	pendingFaceIdMatch: FaceIdMatch | null;
	clearPendingMatch: () => void;
	isFaceIdCooldownActive: boolean;

	// Snapshot capture
	captureSecuritySnapshot: (
		eventType: "TAP" | "FACE_ID" | "FACE_ID_ENROLLMENT" | "PRESENCE",
		userId?: number,
	) => Promise<void>;

	// Smart photo security system
	cancelPendingPresenceSnapshots: () => void;
	notifyTapEvent: () => void;

	// Models
	modelsLoaded: boolean;
}

const CameraContext = createContext<CameraContextValue | null>(null);

interface CameraProviderProps {
	children: ReactNode;
	enabled?: boolean;
}

export function CameraProvider({
	children,
	enabled = true,
}: CameraProviderProps) {
	const camera = useCamera({ autoStart: false });
	const [pendingFaceIdMatch, setPendingFaceIdMatch] =
		useState<FaceIdMatch | null>(null);
	const [modelsLoaded, setModelsLoaded] = useState(false);

	// ==========================================================================
	// Smart Photo Security System State
	// ==========================================================================

	/** Map of pending presence snapshots by ID */
	const pendingPresenceSnapshotsRef = useRef<
		Map<string, PendingPresenceSnapshot>
	>(new Map());

	/** Timestamps of recent presence snapshots for rate limiting */
	const presenceSnapshotTimestampsRef = useRef<number[]>([]);

	/** Last snapshot time per face ID to prevent spam from same face */
	const faceSnapshotCooldownsRef = useRef<Map<string, number>>(new Map());

	/** Last global presence snapshot timestamp - updated at SEND time to prevent race conditions */
	const lastGlobalPresenceSnapshotRef = useRef<number>(0);

	/** Timestamp of last authentication event (tap or Face ID) */
	const lastAuthEventRef = useRef<number>(0);

	/** Set of face IDs that have authenticated (to track who's "good") */
	const authenticatedFaceIdsRef = useRef<Set<string>>(new Set());

	// Initialize face-api models
	useEffect(() => {
		if (!enabled) return;

		const loadModels = async () => {
			try {
				await loadFaceApiModels();
				setModelsLoaded(true);
			} catch (err) {
				console.error("[CameraProvider] Failed to load models:", err);
			}
		};

		void loadModels();
	}, [enabled]);

	// Face ID handling
	const handleFaceIdMatch = useCallback((match: FaceIdMatch) => {
		console.log("[CameraProvider] Face ID match received:", {
			userId: match.userId,
			userName: match.userName,
			confidence: match.confidence,
			hasCardNumber: !!match.cardNumber,
		});
		setPendingFaceIdMatch(match);
	}, []);

	const faceId = useFaceId({
		videoRef: camera.videoRef,
		enabled: enabled && modelsLoaded,
		onMatch: handleFaceIdMatch,
	});

	const clearPendingMatch = useCallback(() => {
		console.log("[CameraProvider] Clearing pending Face ID match");
		setPendingFaceIdMatch(null);
	}, []);

	// ==========================================================================
	// Smart Photo Security System Functions
	// ==========================================================================

	/**
	 * Cancel all pending presence snapshots (called when user taps)
	 */
	const cancelPendingPresenceSnapshots = useCallback(() => {
		const pending = pendingPresenceSnapshotsRef.current;
		if (pending.size > 0) {
			console.log(
				`[CameraProvider] Cancelling ${pending.size} pending presence snapshot(s) due to authentication event`,
			);
			for (const snapshot of pending.values()) {
				clearTimeout(snapshot.timeoutId);
			}
			pending.clear();
		}
	}, []);

	/**
	 * Notify that a tap/authentication event occurred - cancels pending presence snapshots
	 * and marks the current face as authenticated
	 */
	const notifyTapEvent = useCallback(() => {
		const now = Date.now();
		lastAuthEventRef.current = now;

		// Mark the current tracked face as authenticated if present
		const currentFace = faceId.currentTrackedFace;
		if (currentFace) {
			authenticatedFaceIdsRef.current.add(currentFace.id);
			console.log(
				`[CameraProvider] Marked face ${currentFace.id.slice(0, 8)} as authenticated`,
			);
		}

		cancelPendingPresenceSnapshots();
	}, [cancelPendingPresenceSnapshots, faceId.currentTrackedFace]);

	/**
	 * Check if we're within the grace period after an authentication event
	 */
	const isInAuthGracePeriod = useCallback((): boolean => {
		const now = Date.now();
		return now - lastAuthEventRef.current < AUTH_GRACE_PERIOD_MS;
	}, []);

	/**
	 * Check if we can take a presence snapshot (rate limiting) - used at SCHEDULE time
	 * Returns detailed info about why it was blocked if so
	 */
	const canSchedulePresenceSnapshot = useCallback(
		(faceId: string): { allowed: boolean; reason?: string } => {
			const now = Date.now();

			// Check if this face has already authenticated
			if (authenticatedFaceIdsRef.current.has(faceId)) {
				return {
					allowed: false,
					reason: `face ${faceId.slice(0, 8)} already authenticated`,
				};
			}

			// Check auth grace period
			if (isInAuthGracePeriod()) {
				return { allowed: false, reason: "within auth grace period" };
			}

			// Check per-face cooldown
			const lastFaceSnapshot = faceSnapshotCooldownsRef.current.get(faceId);
			if (lastFaceSnapshot && now - lastFaceSnapshot < SAME_FACE_COOLDOWN_MS) {
				const remaining = Math.ceil(
					(SAME_FACE_COOLDOWN_MS - (now - lastFaceSnapshot)) / 1000,
				);
				return {
					allowed: false,
					reason: `face ${faceId.slice(0, 8)} in cooldown (${remaining}s remaining)`,
				};
			}

			// Check rate limit (max snapshots per minute)
			const oneMinuteAgo = now - 60000;
			const recentSnapshots = presenceSnapshotTimestampsRef.current.filter(
				(t) => t > oneMinuteAgo,
			);
			presenceSnapshotTimestampsRef.current = recentSnapshots; // Clean up old timestamps

			if (recentSnapshots.length >= MAX_PRESENCE_SNAPSHOTS_PER_MINUTE) {
				return {
					allowed: false,
					reason: `rate limit exceeded (${recentSnapshots.length}/${MAX_PRESENCE_SNAPSHOTS_PER_MINUTE} per minute)`,
				};
			}

			return { allowed: true };
		},
		[isInAuthGracePeriod],
	);

	/**
	 * Check if we can send a presence snapshot NOW (checked at SEND time)
	 * This is the critical check that prevents race conditions
	 */
	const canSendPresenceSnapshotNow = useCallback((): {
		allowed: boolean;
		reason?: string;
	} => {
		const now = Date.now();

		// Check auth grace period again at send time
		if (isInAuthGracePeriod()) {
			return { allowed: false, reason: "within auth grace period" };
		}

		// CRITICAL: Check global cooldown at send time to prevent race conditions
		const timeSinceLastSend = now - lastGlobalPresenceSnapshotRef.current;
		if (timeSinceLastSend < GLOBAL_PRESENCE_COOLDOWN_MS) {
			const remaining = Math.ceil(
				(GLOBAL_PRESENCE_COOLDOWN_MS - timeSinceLastSend) / 1000,
			);
			return {
				allowed: false,
				reason: `global cooldown active (${remaining}s remaining)`,
			};
		}

		// Check rate limit at send time as well
		const oneMinuteAgo = now - 60000;
		const recentSnapshots = presenceSnapshotTimestampsRef.current.filter(
			(t) => t > oneMinuteAgo,
		);
		if (recentSnapshots.length >= MAX_PRESENCE_SNAPSHOTS_PER_MINUTE) {
			return { allowed: false, reason: `rate limit exceeded at send time` };
		}

		return { allowed: true };
	}, [isInAuthGracePeriod]);

	/**
	 * Send a presence snapshot to the server
	 * This function performs final rate limiting checks at send time
	 */
	const sendPresenceSnapshot = useCallback(
		async (snapshot: PendingPresenceSnapshot): Promise<boolean> => {
			const now = Date.now();

			// CRITICAL: Re-check rate limiting at send time to prevent race conditions
			const canSend = canSendPresenceSnapshotNow();
			if (!canSend.allowed) {
				console.log(
					`[CameraProvider] Presence snapshot ${snapshot.id} blocked at send time: ${canSend.reason}`,
				);
				return false;
			}

			// Double-check this specific face hasn't authenticated since scheduling
			if (authenticatedFaceIdsRef.current.has(snapshot.faceId)) {
				console.log(
					`[CameraProvider] Presence snapshot ${snapshot.id} blocked: face authenticated since scheduling`,
				);
				return false;
			}

			try {
				const metadata = {
					reason: snapshot.reason,
					faceId: snapshot.faceId.slice(0, 8),
					scheduledAt: snapshot.scheduledAt,
					delayMs: now - snapshot.scheduledAt,
					qualityScore: snapshot.bestQualityScore,
					frameUpdates: snapshot.frameUpdates,
					faceSize: `${(snapshot.faceBox.width * 100).toFixed(0)}%`,
				};

				console.log(
					`[CameraProvider] Sending presence snapshot ${snapshot.id}:`,
					metadata,
				);

				await trpc.security.uploadSnapshot.mutate({
					imageData: snapshot.imageData,
					eventType: "PRESENCE",
					faceDetected: true,
					faceConfidence: snapshot.confidence,
					metadata: JSON.stringify(metadata),
				});

				// Update rate limiting trackers AFTER successful send
				presenceSnapshotTimestampsRef.current.push(now);
				faceSnapshotCooldownsRef.current.set(snapshot.faceId, now);
				lastGlobalPresenceSnapshotRef.current = now;

				console.log(
					`[CameraProvider] Presence snapshot ${snapshot.id} uploaded successfully`,
				);
				return true;
			} catch (err) {
				console.error(
					`[CameraProvider] Failed to upload presence snapshot ${snapshot.id}:`,
					err,
				);
				return false;
			}
		},
		[canSendPresenceSnapshotNow],
	);

	/**
	 * Calculate a quality score for a face detection frame.
	 * Higher scores indicate better quality frames for security snapshots.
	 */
	const calculateFrameQuality = useCallback(
		(
			confidence: number,
			faceBox: { width: number; height: number; x: number; y: number },
			videoDimensions: { width: number; height: number },
		): FrameQuality => {
			// Face size score (prefer larger faces, but not too large)
			const faceSize = faceBox.width / videoDimensions.width;
			const idealSize = 0.25; // 25% of frame width is ideal
			const sizeScore = Math.max(
				0,
				1 - Math.abs(faceSize - idealSize) / idealSize,
			);

			// Centering score (prefer faces near center)
			const faceCenterX = faceBox.x + faceBox.width / 2;
			const faceCenterY = faceBox.y + faceBox.height / 2;
			const frameCenterX = videoDimensions.width / 2;
			const frameCenterY = videoDimensions.height / 2;
			const offsetX =
				Math.abs(faceCenterX - frameCenterX) / videoDimensions.width;
			const offsetY =
				Math.abs(faceCenterY - frameCenterY) / videoDimensions.height;
			const centering = 1 - Math.sqrt(offsetX * offsetX + offsetY * offsetY);

			// Overall score (weighted combination)
			const score =
				confidence * 0.4 + // Detection confidence
				sizeScore * 0.3 + // Face size
				centering * 0.3; // Face centering

			return {
				score,
				faceSize,
				confidence,
				centering,
				stability: 1.0, // Will be updated during tracking
			};
		},
		[],
	);

	/**
	 * Schedule a presence snapshot for a qualified face.
	 *
	 * Improved Flow:
	 * 1. When a new face meets criteria, capture initial snapshot
	 * 2. Continue monitoring for better quality frames during delay period
	 * 3. If user taps during delay, cancel the snapshot (notifyTapEvent)
	 * 4. If delay expires with no action, send the BEST quality frame captured
	 * 5. Re-check rate limits at send time to prevent race conditions
	 */
	const schedulePresenceSnapshot = useCallback(
		(
			trackedFaceId: string,
			confidence: number,
			faceBox: { width: number; height: number; x: number; y: number },
			videoDimensions: { width: number; height: number },
			reason: PresenceSnapshotReason = "UNAUTHENTICATED_PRESENCE",
		) => {
			// Check if this face already has a pending snapshot - if so, potentially update it
			for (const [
				snapshotId,
				pending,
			] of pendingPresenceSnapshotsRef.current.entries()) {
				if (pending.faceId === trackedFaceId) {
					// Already have a pending snapshot for this face - check if this frame is better
					const quality = calculateFrameQuality(
						confidence,
						faceBox,
						videoDimensions,
					);

					if (
						quality.score > pending.bestQualityScore &&
						quality.score >= MIN_FRAME_QUALITY_SCORE
					) {
						// This frame is better - update the pending snapshot
						const video = camera.videoRef.current;
						if (video && video.readyState >= 2 && video.videoWidth > 0) {
							const imageData = captureSnapshot(video, 0.85); // Slightly higher quality for best frame
							pending.imageData = imageData;
							pending.confidence = confidence;
							pending.bestFrameCapturedAt = Date.now();
							pending.bestQualityScore = quality.score;
							pending.faceBox = faceBox;
							pending.frameUpdates++;

							console.log(
								`[CameraProvider] Updated pending snapshot ${snapshotId} with better frame (quality: ${(quality.score * 100).toFixed(0)}%)`,
							);
						}
					}
					return; // Don't create a new snapshot
				}
			}

			// Check rate limiting at schedule time
			const canSchedule = canSchedulePresenceSnapshot(trackedFaceId);
			if (!canSchedule.allowed) {
				console.log(
					`[CameraProvider] Presence snapshot blocked at schedule time: ${canSchedule.reason}`,
				);
				return;
			}

			// Check face size is good enough for a quality snapshot
			const faceSizeRatio = faceBox.width / videoDimensions.width;
			if (faceSizeRatio < MIN_PRESENCE_FACE_SIZE_RATIO) {
				console.log(
					`[CameraProvider] Presence snapshot blocked: face too small (${(faceSizeRatio * 100).toFixed(1)}%)`,
				);
				return;
			}

			// Check confidence threshold
			if (confidence < MIN_PRESENCE_CONFIDENCE) {
				console.log(
					`[CameraProvider] Presence snapshot blocked: confidence too low (${(confidence * 100).toFixed(0)}%)`,
				);
				return;
			}

			// Calculate initial frame quality
			const quality = calculateFrameQuality(
				confidence,
				faceBox,
				videoDimensions,
			);
			if (quality.score < MIN_FRAME_QUALITY_SCORE) {
				console.log(
					`[CameraProvider] Presence snapshot blocked: frame quality too low (${(quality.score * 100).toFixed(0)}%)`,
				);
				return;
			}

			// Capture the image now (while the face is in good position)
			const video = camera.videoRef.current;
			if (!video || video.readyState < 2 || video.videoWidth === 0) {
				console.log(
					"[CameraProvider] Presence snapshot blocked: video not ready",
				);
				return;
			}

			const imageData = captureSnapshot(video, 0.85);
			const snapshotId = `presence-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
			const now = Date.now();

			console.log(
				`[CameraProvider] Scheduling presence snapshot ${snapshotId} for face ${trackedFaceId.slice(0, 8)} (reason: ${reason}, quality: ${(quality.score * 100).toFixed(0)}%, delay: ${PRESENCE_SNAPSHOT_DELAY_MS}ms)`,
			);

			// Send snapshot after delay if not cancelled by a tap event
			// During delay, better frames may be captured and update this snapshot
			const timeoutId = setTimeout(() => {
				const pending = pendingPresenceSnapshotsRef.current.get(snapshotId);
				if (pending) {
					console.log(
						`[CameraProvider] Delay expired for snapshot ${snapshotId} (${pending.frameUpdates} frame updates, best quality: ${(pending.bestQualityScore * 100).toFixed(0)}%)`,
					);
					pendingPresenceSnapshotsRef.current.delete(snapshotId);
					void sendPresenceSnapshot(pending);
				}
			}, PRESENCE_SNAPSHOT_DELAY_MS);

			pendingPresenceSnapshotsRef.current.set(snapshotId, {
				id: snapshotId,
				faceId: trackedFaceId,
				imageData,
				confidence,
				scheduledAt: now,
				bestFrameCapturedAt: now,
				bestQualityScore: quality.score,
				faceBox,
				timeoutId,
				reason,
				frameUpdates: 0,
			});
		},
		[
			camera.videoRef,
			canSchedulePresenceSnapshot,
			sendPresenceSnapshot,
			calculateFrameQuality,
		],
	);

	// ==========================================================================
	// Monitor tracked face for presence snapshots
	// ==========================================================================

	useEffect(() => {
		const trackedFace = faceId.currentTrackedFace;

		if (!trackedFace) return;

		// Only consider faces in "qualified" or "attempted" state (high confidence, stable)
		// These states indicate the face has been tracked long enough to be meaningful
		const qualifyingStates = ["qualified", "attempted", "suppressed"];
		if (!qualifyingStates.includes(trackedFace.state)) return;

		// Get video dimensions
		const video = camera.videoRef.current;
		if (!video || video.videoWidth === 0) return;

		const videoDimensions = {
			width: video.videoWidth,
			height: video.videoHeight,
		};

		// Pass full face box with position for quality scoring
		const faceBox = {
			width: trackedFace.box.width,
			height: trackedFace.box.height,
			x: trackedFace.box.x,
			y: trackedFace.box.y,
		};

		// Schedule a presence snapshot (or update existing one with better frame)
		schedulePresenceSnapshot(
			trackedFace.id,
			trackedFace.confidence,
			faceBox,
			videoDimensions,
			"UNAUTHENTICATED_PRESENCE",
		);
	}, [faceId.currentTrackedFace, camera.videoRef, schedulePresenceSnapshot]);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			// Clear all pending snapshots
			for (const snapshot of pendingPresenceSnapshotsRef.current.values()) {
				clearTimeout(snapshot.timeoutId);
			}
			pendingPresenceSnapshotsRef.current.clear();
		};
	}, []);

	// Periodic cleanup of stale data (every 60 seconds)
	useEffect(() => {
		const cleanupInterval = setInterval(() => {
			const now = Date.now();

			// Clean up old face cooldowns (older than 2x the cooldown period)
			const maxCooldownAge = SAME_FACE_COOLDOWN_MS * 2;
			for (const [
				faceId,
				timestamp,
			] of faceSnapshotCooldownsRef.current.entries()) {
				if (now - timestamp > maxCooldownAge) {
					faceSnapshotCooldownsRef.current.delete(faceId);
				}
			}

			// Clean up old authenticated face IDs (clear periodically if set gets large)
			// Note: We can't easily track when individual faces were authenticated
			if (authenticatedFaceIdsRef.current.size > 50) {
				console.log(
					`[CameraProvider] Clearing ${authenticatedFaceIdsRef.current.size} old authenticated face IDs`,
				);
				authenticatedFaceIdsRef.current.clear();
			}

			// Clean up old snapshot timestamps (already handled in canSchedulePresenceSnapshot, but double-check)
			const oneMinuteAgo = now - 60000;
			presenceSnapshotTimestampsRef.current =
				presenceSnapshotTimestampsRef.current.filter((t) => t > oneMinuteAgo);
		}, 60000);

		return () => clearInterval(cleanupInterval);
	}, []);

	// Capture security snapshot
	const captureSecuritySnapshot = useCallback(
		async (
			eventType: "TAP" | "FACE_ID" | "FACE_ID_ENROLLMENT" | "PRESENCE",
			userId?: number,
		) => {
			const video = camera.videoRef.current;
			const videoReady = video && video.readyState >= 2 && video.videoWidth > 0;

			console.log("[CameraProvider] Capturing security snapshot:", {
				eventType,
				userId,
				isCameraReady: camera.isReady,
				hasVideoRef: !!video,
				videoReady,
				videoReadyState: video?.readyState,
				videoWidth: video?.videoWidth,
			});

			// Check the video element directly instead of relying on React state
			// This avoids issues with stale closures from async callbacks
			if (!video || !videoReady) {
				console.warn(
					"[CameraProvider] Camera not ready for snapshot - video element not ready",
				);
				return;
			}

			try {
				const imageData = captureSnapshot(video, 0.8);
				console.log(
					"[CameraProvider] Snapshot captured, data length:",
					imageData.length,
				);

				// Detect face in the snapshot
				let faceDetected = false;
				let faceConfidence: number | undefined;

				if (areModelsLoaded()) {
					const detection = await detectFace(video);
					faceDetected = detection.detected;
					faceConfidence = detection.confidence;
					console.log("[CameraProvider] Face detection result:", {
						faceDetected,
						faceConfidence,
					});
				}

				// Upload to server
				console.log("[CameraProvider] Uploading snapshot to server...");
				await trpc.security.uploadSnapshot.mutate({
					imageData,
					eventType,
					userId,
					faceDetected,
					faceConfidence,
				});
				console.log("[CameraProvider] Snapshot uploaded successfully");
			} catch (err) {
				console.error("[CameraProvider] Failed to capture snapshot:", err);
			}
		},
		[camera.videoRef],
	);

	const contextValue: CameraContextValue = {
		// Camera
		videoRef: camera.videoRef,
		cameraStatus: camera.status,
		cameraError: camera.error,
		startCamera: camera.start,
		stopCamera: camera.stop,
		isCameraReady: camera.isReady,
		cameraDimensions: camera.dimensions,
		captureDataUrl: camera.captureDataUrl,

		// Face ID
		faceIdStatus: faceId.status,
		faceIdError: faceId.error,
		isFaceIdReady: faceId.isReady,
		startFaceIdScanning: faceId.startScanning,
		stopFaceIdScanning: faceId.stopScanning,
		isFaceIdScanning: faceId.isScanning,
		faceIdTrackerStats: faceId.trackerStats,
		currentTrackedFace: faceId.currentTrackedFace,

		// Match handling
		pendingFaceIdMatch,
		clearPendingMatch,
		isFaceIdCooldownActive: faceId.isCooldownActive,

		// Snapshots
		captureSecuritySnapshot,

		// Smart photo security system
		cancelPendingPresenceSnapshots,
		notifyTapEvent,

		// Models
		modelsLoaded,
	};

	return (
		<CameraContext.Provider value={contextValue}>
			{children}
			{/* Hidden video element for camera feed - rendered off-screen but with proper dimensions for face detection */}
			{enabled && (
				<video
					ref={camera.videoRef}
					autoPlay
					playsInline
					muted
					style={{
						position: "fixed",
						// Keep full dimensions for face detection to work properly
						width: "640px",
						height: "480px",
						// Position off-screen
						left: "-9999px",
						top: "-9999px",
						opacity: 0,
						pointerEvents: "none",
					}}
				/>
			)}
		</CameraContext.Provider>
	);
}

export function useCameraContext(): CameraContextValue {
	const context = useContext(CameraContext);
	if (!context) {
		throw new Error("useCameraContext must be used within a CameraProvider");
	}
	return context;
}
