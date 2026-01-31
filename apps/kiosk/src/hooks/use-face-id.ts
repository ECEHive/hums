/**
 * useFaceId hook for Face ID recognition (v2 - Stateful Tracking)
 *
 * This is a complete refactor of the face identification system to be
 * stateful and event-driven rather than frame-driven and reactive.
 *
 * Key improvements:
 * - Face eligibility filtering (size, confidence, head pose)
 * - Temporal stability requirement before identification
 * - Per-face identification attempt tracking
 * - Distinct handling of new vs. existing faces
 * - Face lifecycle states: Detected → Qualified → Attempted → Suppressed
 *
 * Uses server-side face matching for security (no descriptors stored locally)
 */

import { trpc } from "@ecehive/trpc/client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	areModelsLoaded,
	detectFace,
	type FaceDetectionResult,
	getVideoDimensions,
	loadFaceApiModels,
	toTrackerDetection,
} from "@/lib/face-api";
import {
	FaceTracker,
	MATCH_SUPPRESSION_DURATION_MS,
	type TrackedFace,
} from "@/lib/face-tracker";

// ============================================================================
// Configuration
// ============================================================================

/** How often to scan for faces (ms) */
const SCAN_INTERVAL_MS = 250;

/** Minimum video readiness for scanning */
const MIN_VIDEO_READY_STATE = 2;

/** Minimum confidence from server match to trigger callback */
const MIN_SERVER_MATCH_CONFIDENCE = 0.2;

/** Cooldown between recognitions for the same user (fallback, tracker handles most cases) */
const USER_COOLDOWN_MS = MATCH_SUPPRESSION_DURATION_MS;

// ============================================================================
// Types
// ============================================================================

export type FaceIdStatus =
	| "initializing"
	| "loading_models"
	| "ready"
	| "scanning"
	| "error"
	| "disabled";

export interface FaceIdMatch {
	userId: number;
	userName: string;
	cardNumber: string | null;
	confidence: number;
}

export interface TrackerStats {
	totalFaces: number;
	detected: number;
	qualified: number;
	attempted: number;
	suppressed: number;
}

export interface UseFaceIdOptions {
	/** Video element reference for face scanning */
	videoRef: React.RefObject<HTMLVideoElement | null>;
	/** Whether Face ID is enabled */
	enabled?: boolean;
	/** Callback when a face is matched */
	onMatch?: (match: FaceIdMatch) => void;
	/** Callback for errors */
	onError?: (error: string) => void;
}

export interface UseFaceIdResult {
	/** Current status */
	status: FaceIdStatus;
	/** Error message if any */
	error: string | null;
	/** Whether Face ID is ready for scanning */
	isReady: boolean;
	/** Current face detection result (for backward compatibility) */
	currentDetection: FaceDetectionResult | null;
	/** Current tracked face being processed (if any) */
	currentTrackedFace: TrackedFace | null;
	/** Start scanning for faces */
	startScanning: () => void;
	/** Stop scanning for faces */
	stopScanning: () => void;
	/** Whether scanning is active */
	isScanning: boolean;

	/** Last matched user ID (for cooldown) */
	lastMatchedUserId: number | null;
	/** Whether cooldown is active */
	isCooldownActive: boolean;
	/** Face tracker stats for debugging */
	trackerStats: TrackerStats;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useFaceId(options: UseFaceIdOptions): UseFaceIdResult {
	const { videoRef, enabled = true, onMatch, onError } = options;

	// State
	const [status, setStatus] = useState<FaceIdStatus>("initializing");
	const [error, setError] = useState<string | null>(null);
	const [isScanning, setIsScanning] = useState(false);
	const [lastMatchedUserId, setLastMatchedUserId] = useState<number | null>(
		null,
	);
	const [currentTrackedFace, setCurrentTrackedFace] =
		useState<TrackedFace | null>(null);
	const [currentDetection, setCurrentDetection] =
		useState<FaceDetectionResult | null>(null);
	const [trackerStats, setTrackerStats] = useState<TrackerStats>({
		totalFaces: 0,
		detected: 0,
		qualified: 0,
		attempted: 0,
		suppressed: 0,
	});

	// Refs
	const faceTrackerRef = useRef<FaceTracker | null>(null);
	const isMatchingRef = useRef(false);
	const isScanningRef = useRef(false);
	const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);
	const cooldownTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const cooldownUsersRef = useRef<Map<number, number>>(new Map());

	// Initialize FaceTracker
	useEffect(() => {
		faceTrackerRef.current = new FaceTracker({});

		return () => {
			faceTrackerRef.current?.clear();
		};
	}, []);

	// Initialize face-api models
	useEffect(() => {
		if (!enabled) {
			setStatus("disabled");
			return;
		}

		const initModels = async () => {
			try {
				setStatus("loading_models");
				await loadFaceApiModels();
				setStatus("ready");
				console.log("[useFaceId] Initialized and ready (v2 stateful tracking)");
			} catch (err) {
				console.error("[useFaceId] Failed to initialize:", err);
				const message =
					err instanceof Error ? err.message : "Failed to initialize Face ID";
				setStatus("error");
				setError(message);
				onError?.(message);
			}
		};

		void initModels();
	}, [enabled, onError]);

	// Check if a specific user is in cooldown (fallback for edge cases)
	const isUserInCooldown = useCallback((userId: number): boolean => {
		const cooldownExpiry = cooldownUsersRef.current.get(userId);
		if (!cooldownExpiry) return false;
		if (Date.now() > cooldownExpiry) {
			cooldownUsersRef.current.delete(userId);
			return false;
		}
		return true;
	}, []);

	// Set cooldown for a user
	const setCooldownForUser = useCallback((userId: number) => {
		const expiryTime = Date.now() + USER_COOLDOWN_MS;
		cooldownUsersRef.current.set(userId, expiryTime);
		setLastMatchedUserId(userId);

		if (cooldownTimeoutRef.current) {
			clearTimeout(cooldownTimeoutRef.current);
		}
		cooldownTimeoutRef.current = setTimeout(() => {
			setLastMatchedUserId(null);
		}, USER_COOLDOWN_MS);
	}, []);

	// Attempt identification for a qualified face
	const attemptIdentification = useCallback(
		async (face: TrackedFace) => {
			const tracker = faceTrackerRef.current;
			if (!tracker || !face.descriptor) return;

			// Mark as attempted
			tracker.markFaceAttempted(face.id);
			isMatchingRef.current = true;

			try {
				const result = await trpc.faceId.matchFace.mutate({
					faceDescriptor: face.descriptor,
				});

				if (result.matched && result.user) {
					// Check server confidence threshold
					if (result.confidence < MIN_SERVER_MATCH_CONFIDENCE) {
						tracker.markFaceNoMatch(face.id);
						return;
					}

					// Check user cooldown (fallback)
					if (isUserInCooldown(result.user.id)) {
						tracker.markFaceMatched(face.id, result.user.id);
						return;
					}

					console.log("[useFaceId] Face matched:", result.user.name);

					// Mark face as matched in tracker
					tracker.markFaceMatched(face.id, result.user.id);

					// Set user cooldown
					setCooldownForUser(result.user.id);

					// Trigger match callback
					onMatch?.({
						userId: result.user.id,
						userName: result.user.name,
						cardNumber: result.user.cardNumber,
						confidence: result.confidence,
					});
				} else {
					// No match found
					tracker.markFaceNoMatch(face.id);
				}
			} catch (err) {
				console.error("[useFaceId] Identification error:", err);
				// On error, mark as no match to allow retry later
				tracker.markFaceNoMatch(face.id);
			} finally {
				isMatchingRef.current = false;
			}
		},
		[onMatch, isUserInCooldown, setCooldownForUser],
	);

	// Face scanning loop
	const performScan = useCallback(async () => {
		const video = videoRef.current;
		const tracker = faceTrackerRef.current;

		// Check preconditions
		if (!isScanningRef.current || !tracker) return;

		const videoReady =
			video &&
			video.readyState >= MIN_VIDEO_READY_STATE &&
			video.videoWidth > 0;
		if (!videoReady) return;

		if (!areModelsLoaded()) return;

		// Skip if already processing an identification
		if (isMatchingRef.current) return;

		try {
			// Update tracker's video dimensions
			const dimensions = getVideoDimensions(video);
			if (dimensions) {
				tracker.setVideoDimensions(dimensions.width, dimensions.height);
			}

			// Detect face
			const detection = await detectFace(video);
			setCurrentDetection(detection); // For backward compatibility
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

			// Find a face ready for identification
			const faceToIdentify = tracker.getFaceReadyForIdentification();

			if (faceToIdentify) {
				setCurrentTrackedFace(faceToIdentify);
				await attemptIdentification(faceToIdentify);
			} else {
				// Show the most recent detected face for UI feedback
				const allFaces = tracker.getAllFaces();
				setCurrentTrackedFace(allFaces.length > 0 ? allFaces[0] : null);
			}
		} catch (err) {
			console.error("[useFaceId] Scan error:", err);
		}
	}, [videoRef, attemptIdentification]);

	// Start scanning
	const startScanning = useCallback(() => {
		if (status !== "ready" || isScanning) {
			console.log("[useFaceId] Cannot start scanning:", { status, isScanning });
			return;
		}

		console.log("[useFaceId] Starting face scanning (v2 stateful tracking)");
		setIsScanning(true);
		isScanningRef.current = true;
		setStatus("scanning");

		// Clear tracker state
		faceTrackerRef.current?.clear();

		// Perform an immediate scan
		void performScan();

		scanIntervalRef.current = setInterval(() => {
			void performScan();
		}, SCAN_INTERVAL_MS);
	}, [status, isScanning, performScan]);

	// Stop scanning
	const stopScanning = useCallback(() => {
		console.log("[useFaceId] Stopping face scanning");
		setIsScanning(false);
		isScanningRef.current = false;
		setStatus("ready");
		setCurrentTrackedFace(null);
		setCurrentDetection(null);

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
			if (scanIntervalRef.current) {
				clearInterval(scanIntervalRef.current);
			}
			if (cooldownTimeoutRef.current) {
				clearTimeout(cooldownTimeoutRef.current);
			}
		};
	}, []);

	return {
		status,
		error,
		isReady: status === "ready" || status === "scanning",
		currentDetection, // Backward compatibility
		currentTrackedFace,
		startScanning,
		stopScanning,
		isScanning,
		lastMatchedUserId,
		isCooldownActive: lastMatchedUserId !== null,
		trackerStats,
	};
}
