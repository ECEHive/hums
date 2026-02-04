/**
 * Camera Provider - Manages shared camera access across the kiosk app
 * Provides face presence detection for security snapshots (not Face ID recognition)
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
	areModelsLoaded,
	captureSnapshot,
	detectFace,
	loadFaceApiModels,
} from "@/lib/face-api";
import { FaceTracker, type TrackedFace } from "@/lib/face-tracker";

// =============================================================================
// Smart Photo Security System Configuration
// =============================================================================

/** Minimum face confidence to trigger a presence snapshot */
const MIN_PRESENCE_CONFIDENCE = 0.5;

/** Minimum face size ratio (relative to frame width) for a quality snapshot */
const MIN_PRESENCE_FACE_SIZE_RATIO = 0.05;

/**
 * Delay (ms) after face detection before sending presence snapshot.
 * During this window, if the user taps (card), the snapshot is cancelled.
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

/** How often to scan for faces (ms) */
const SCAN_INTERVAL_MS = 250;

/** Minimum video readiness for scanning */
const MIN_VIDEO_READY_STATE = 2;

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

export interface TrackerStats {
	totalFaces: number;
	detected: number;
	qualified: number;
	attempted: number;
	suppressed: number;
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

	// Face presence detection state
	isFacePresenceScanning: boolean;
	startFacePresenceScanning: () => void;
	stopFacePresenceScanning: () => void;
	currentTrackedFace: TrackedFace | null;
	trackerStats: TrackerStats;

	// Snapshot capture
	captureSecuritySnapshot: (
		eventType: "TAP" | "PRESENCE",
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
	const [modelsLoaded, setModelsLoaded] = useState(false);
	const [isFacePresenceScanning, setIsFacePresenceScanning] = useState(false);
	const [currentTrackedFace, setCurrentTrackedFace] =
		useState<TrackedFace | null>(null);
	const [trackerStats, setTrackerStats] = useState<TrackerStats>({
		totalFaces: 0,
		detected: 0,
		qualified: 0,
		attempted: 0,
		suppressed: 0,
	});

	// Face presence scanning refs
	const faceTrackerRef = useRef<FaceTracker | null>(null);
	const isScanningRef = useRef(false);
	const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);

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

	/** Timestamp of last authentication event (tap) */
	const lastAuthEventRef = useRef<number>(0);

	/** Set of face IDs that have authenticated (to track who's "good") */
	const authenticatedFaceIdsRef = useRef<Set<string>>(new Set());

	// Initialize FaceTracker
	useEffect(() => {
		faceTrackerRef.current = new FaceTracker({});

		return () => {
			faceTrackerRef.current?.clear();
		};
	}, []);

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
		if (currentTrackedFace) {
			authenticatedFaceIdsRef.current.add(currentTrackedFace.id);
			console.log(
				`[CameraProvider] Marked face ${currentTrackedFace.id.slice(0, 8)} as authenticated`,
			);
		}

		cancelPendingPresenceSnapshots();
	}, [cancelPendingPresenceSnapshots, currentTrackedFace]);

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

	/**
	 * Convert FaceDetectionResult to tracker detection format
	 */
	const toTrackerDetection = (
		detection: {
			detected: boolean;
			confidence: number;
			box: { x: number; y: number; width: number; height: number } | null;
			descriptor: Float32Array | null;
			yawAngle: number | null;
		} | null,
	): {
		confidence: number;
		box: { x: number; y: number; width: number; height: number };
		descriptor: number[] | null;
		yawAngle: number | null;
	} | null => {
		if (!detection?.detected || !detection.box) return null;
		return {
			confidence: detection.confidence,
			box: detection.box,
			descriptor: detection.descriptor
				? Array.from(detection.descriptor)
				: null,
			yawAngle: detection.yawAngle,
		};
	};

	/**
	 * Get video dimensions
	 */
	const getVideoDimensions = (
		video: HTMLVideoElement,
	): { width: number; height: number } | null => {
		if (video.videoWidth === 0 || video.videoHeight === 0) return null;
		return { width: video.videoWidth, height: video.videoHeight };
	};

	/**
	 * Face presence scanning loop
	 */
	const performScan = useCallback(async () => {
		const video = camera.videoRef.current;
		const tracker = faceTrackerRef.current;

		// Check preconditions
		if (!isScanningRef.current || !tracker) return;

		const videoReady =
			video &&
			video.readyState >= MIN_VIDEO_READY_STATE &&
			video.videoWidth > 0;
		if (!videoReady) return;

		if (!areModelsLoaded()) return;

		try {
			// Update tracker's video dimensions
			const dimensions = getVideoDimensions(video);
			if (dimensions) {
				tracker.setVideoDimensions(dimensions.width, dimensions.height);
			}

			// Detect face
			const detection = await detectFace(video);
			const trackerDetection = toTrackerDetection(detection);

			// Process frame (handles tracking, stability, state transitions)
			const detections = trackerDetection ? [trackerDetection] : [];
			tracker.processFrame(detections);

			// Update stats
			const stats = tracker.getStats();
			setTrackerStats({
				totalFaces: stats.totalFaces,
				detected: stats.byState.detected,
				qualified: stats.byState.qualified,
				attempted: stats.byState.attempted,
				suppressed: stats.byState.suppressed,
			});

			// Get the most recent detected face for tracking
			const allFaces = tracker.getAllFaces();
			const trackedFace = allFaces.length > 0 ? allFaces[0] : null;
			setCurrentTrackedFace(trackedFace);

			// Schedule presence snapshot if face is qualified
			if (trackedFace) {
				const qualifyingStates = ["qualified", "attempted", "suppressed"];
				if (qualifyingStates.includes(trackedFace.state) && dimensions) {
					const faceBox = {
						width: trackedFace.box.width,
						height: trackedFace.box.height,
						x: trackedFace.box.x,
						y: trackedFace.box.y,
					};
					schedulePresenceSnapshot(
						trackedFace.id,
						trackedFace.confidence,
						faceBox,
						dimensions,
						"UNAUTHENTICATED_PRESENCE",
					);
				}
			}
		} catch (err) {
			console.error("[CameraProvider] Scan error:", err);
		}
	}, [camera.videoRef, schedulePresenceSnapshot]);

	/**
	 * Start face presence scanning
	 */
	const startFacePresenceScanning = useCallback(() => {
		if (isFacePresenceScanning) {
			console.log("[CameraProvider] Already scanning for face presence");
			return;
		}

		console.log("[CameraProvider] Starting face presence scanning");
		setIsFacePresenceScanning(true);
		isScanningRef.current = true;

		// Clear tracker state
		faceTrackerRef.current?.clear();

		// Perform an immediate scan
		void performScan();

		scanIntervalRef.current = setInterval(() => {
			void performScan();
		}, SCAN_INTERVAL_MS);
	}, [isFacePresenceScanning, performScan]);

	/**
	 * Stop face presence scanning
	 */
	const stopFacePresenceScanning = useCallback(() => {
		console.log("[CameraProvider] Stopping face presence scanning");
		setIsFacePresenceScanning(false);
		isScanningRef.current = false;
		setCurrentTrackedFace(null);

		if (scanIntervalRef.current) {
			clearInterval(scanIntervalRef.current);
			scanIntervalRef.current = null;
		}

		// Clear tracker state
		faceTrackerRef.current?.clear();
		setTrackerStats({
			totalFaces: 0,
			detected: 0,
			qualified: 0,
			attempted: 0,
			suppressed: 0,
		});
	}, []);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			// Clear all pending snapshots
			for (const snapshot of pendingPresenceSnapshotsRef.current.values()) {
				clearTimeout(snapshot.timeoutId);
			}
			pendingPresenceSnapshotsRef.current.clear();

			if (scanIntervalRef.current) {
				clearInterval(scanIntervalRef.current);
			}
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
			if (authenticatedFaceIdsRef.current.size > 50) {
				console.log(
					`[CameraProvider] Clearing ${authenticatedFaceIdsRef.current.size} old authenticated face IDs`,
				);
				authenticatedFaceIdsRef.current.clear();
			}

			// Clean up old snapshot timestamps
			const oneMinuteAgo = now - 60000;
			presenceSnapshotTimestampsRef.current =
				presenceSnapshotTimestampsRef.current.filter((t) => t > oneMinuteAgo);
		}, 60000);

		return () => clearInterval(cleanupInterval);
	}, []);

	// Capture security snapshot
	const captureSecuritySnapshot = useCallback(
		async (eventType: "TAP" | "PRESENCE", userId?: number) => {
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

		// Face presence detection
		isFacePresenceScanning,
		startFacePresenceScanning,
		stopFacePresenceScanning,
		currentTrackedFace,
		trackerStats,

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
