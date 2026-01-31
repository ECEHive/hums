/**
 * useFaceId hook for Face ID recognition
 * Uses server-side face matching for security
 *
 * Features:
 * - Server-side face matching (no descriptors downloaded to client)
 * - Per-user cooldown after successful match
 * - Rate limiting for uncertain/no-match queries
 * - Similar face deduplication to prevent server spam
 */

import { trpc } from "@ecehive/trpc/client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	areModelsLoaded,
	detectFace,
	type FaceDetectionResult,
	loadFaceApiModels,
	serializeDescriptor,
} from "@/lib/face-api";

// Cooldown between Face ID recognitions for the same user (5 seconds)
const FACE_ID_COOLDOWN_MS = 5000;

// Minimum confidence for Face ID match (from server)
// Server already filters by distance threshold, so we use a lower confidence here
const MIN_MATCH_CONFIDENCE = 0.3;

// How often to scan for faces (ms)
const SCAN_INTERVAL_MS = 500;

// Minimum video readiness for scanning
const MIN_VIDEO_READY_STATE = 2;

// Rate limiting for uncertain queries
const UNCERTAIN_QUERY_COOLDOWN_MS = 3000; // Wait 3s between uncertain/no-match queries
const SIMILAR_FACE_THRESHOLD = 0.7; // If descriptor distance < this, consider it "similar" face
const SIMILAR_FACE_CACHE_SIZE = 10; // Keep track of last N queried descriptors that had NO match

// Minimum face quality for server query (avoid sending blurry/partial faces)
const MIN_DETECTION_CONFIDENCE = 0.7;

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
	/** Current face detection result */
	currentDetection: FaceDetectionResult | null;
	/** Start scanning for faces */
	startScanning: () => void;
	/** Stop scanning for faces */
	stopScanning: () => void;
	/** Whether scanning is active */
	isScanning: boolean;
	/** Number of enrolled faces (from server count) */
	enrolledCount: number;
	/** Reload enrolled faces count from server */
	refreshEnrolledFaces: () => Promise<void>;
	/** Last matched user ID (for cooldown) */
	lastMatchedUserId: number | null;
	/** Whether cooldown is active */
	isCooldownActive: boolean;
}

/**
 * Calculate Euclidean distance between two descriptor arrays
 */
function descriptorDistance(a: number[], b: number[]): number {
	if (a.length !== b.length) return Infinity;
	let sum = 0;
	for (let i = 0; i < a.length; i++) {
		const diff = a[i] - b[i];
		sum += diff * diff;
	}
	return Math.sqrt(sum);
}

export function useFaceId(options: UseFaceIdOptions): UseFaceIdResult {
	const { videoRef, enabled = true, onMatch, onError } = options;

	const [status, setStatus] = useState<FaceIdStatus>("initializing");
	const [error, setError] = useState<string | null>(null);
	const [isScanning, setIsScanning] = useState(false);
	const [currentDetection, setCurrentDetection] =
		useState<FaceDetectionResult | null>(null);
	const [enrolledCount, setEnrolledCount] = useState(0);
	const [lastMatchedUserId, setLastMatchedUserId] = useState<number | null>(
		null,
	);

	// Track cooldown per user so different users can still be detected
	const cooldownUsersRef = useRef<Map<number, number>>(new Map());
	// Track if a server request is in progress to avoid duplicate requests
	const isMatchingRef = useRef(false);
	// Use ref for isScanning to avoid stale closure in interval callback
	const isScanningRef = useRef(false);
	// Use ref for enrolledCount to avoid stale closure
	const enrolledCountRef = useRef(0);

	// Rate limiting for uncertain/no-match queries
	const lastUncertainQueryRef = useRef(0);
	// Cache of recent descriptor queries that had NO MATCH to avoid re-querying similar unknown faces
	// Note: We do NOT cache matched faces here - those are handled by per-user cooldown
	const recentUnmatchedDescriptorsRef = useRef<
		{ descriptor: number[]; timestamp: number }[]
	>([]);

	const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);
	const cooldownTimeoutRef = useRef<NodeJS.Timeout | null>(null);

	// Check if a descriptor is similar to a recently queried UNMATCHED face
	// This prevents spamming the server with the same unknown face
	const isSimilarToRecentUnmatched = useCallback(
		(descriptor: number[]): boolean => {
			const now = Date.now();
			// Clean up old entries (older than uncertain cooldown)
			recentUnmatchedDescriptorsRef.current =
				recentUnmatchedDescriptorsRef.current.filter(
					(entry) => now - entry.timestamp < UNCERTAIN_QUERY_COOLDOWN_MS,
				);

			// Check against remaining recent unmatched descriptors
			for (const entry of recentUnmatchedDescriptorsRef.current) {
				const distance = descriptorDistance(descriptor, entry.descriptor);
				if (distance < SIMILAR_FACE_THRESHOLD) {
					console.log(
						"[useFaceId] Similar to recent unmatched face, skipping query (distance:",
						distance.toFixed(3),
						")",
					);
					return true;
				}
			}
			return false;
		},
		[],
	);

	// Add a descriptor to the unmatched cache (only for faces that didn't match anyone)
	const addToUnmatchedCache = useCallback((descriptor: number[]) => {
		recentUnmatchedDescriptorsRef.current.push({
			descriptor,
			timestamp: Date.now(),
		});
		// Keep cache size limited
		if (
			recentUnmatchedDescriptorsRef.current.length > SIMILAR_FACE_CACHE_SIZE
		) {
			recentUnmatchedDescriptorsRef.current.shift();
		}
	}, []);

	// Get enrolled face count from server (we don't download the actual descriptors)
	const refreshEnrolledFaces = useCallback(async () => {
		try {
			const result = await trpc.faceId.getEnrolledFaces.query({});
			// Use the count field directly from the new API response
			const count = result.count ?? result.enrollments.length;
			setEnrolledCount(count);
			enrolledCountRef.current = count;
			console.log("[useFaceId] Enrolled face count:", count);
		} catch (err) {
			console.error("[useFaceId] Failed to get enrolled face count:", err);
			const message =
				err instanceof Error ? err.message : "Failed to get enrolled faces";
			setError(message);
			onError?.(message);
		}
	}, [onError]);

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
				await refreshEnrolledFaces();
				setStatus("ready");
				console.log("[useFaceId] Initialized and ready");
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
	}, [enabled, onError, refreshEnrolledFaces]);

	// Check if a specific user is in cooldown
	const isUserInCooldown = useCallback((userId: number): boolean => {
		const cooldownExpiry = cooldownUsersRef.current.get(userId);
		if (!cooldownExpiry) return false;
		if (Date.now() > cooldownExpiry) {
			// Cooldown expired, remove it
			cooldownUsersRef.current.delete(userId);
			return false;
		}
		return true;
	}, []);

	// Set cooldown for a user
	const setCooldownForUser = useCallback((userId: number) => {
		const expiryTime = Date.now() + FACE_ID_COOLDOWN_MS;
		cooldownUsersRef.current.set(userId, expiryTime);
		setLastMatchedUserId(userId);

		// Clean up after cooldown expires
		if (cooldownTimeoutRef.current) {
			clearTimeout(cooldownTimeoutRef.current);
		}
		cooldownTimeoutRef.current = setTimeout(() => {
			setLastMatchedUserId(null);
		}, FACE_ID_COOLDOWN_MS);
	}, []);

	// Face scanning loop - detects face locally, matches on server
	const performScan = useCallback(async () => {
		const video = videoRef.current;

		// Check video element is ready
		const videoReady =
			video &&
			video.readyState >= MIN_VIDEO_READY_STATE &&
			video.videoWidth > 0;

		// Use refs to avoid stale closure issues
		if (!isScanningRef.current) {
			return;
		}

		if (!videoReady) {
			return;
		}

		if (!areModelsLoaded()) {
			return;
		}

		// Skip if no enrolled faces (use ref)
		if (enrolledCountRef.current === 0) {
			return;
		}

		// Skip if already matching (prevent overlapping server requests)
		if (isMatchingRef.current) {
			return;
		}

		try {
			// Detect face locally (fast)
			const detection = await detectFace(video);
			setCurrentDetection(detection);

			// If a face with descriptor is detected, consider sending to server
			if (detection.detected && detection.descriptor) {
				// Check minimum quality
				if (detection.confidence < MIN_DETECTION_CONFIDENCE) {
					console.log(
						"[useFaceId] Face quality too low:",
						detection.confidence.toFixed(3),
						"< min:",
						MIN_DETECTION_CONFIDENCE,
					);
					return;
				}

				// Serialize the descriptor for comparison and sending
				const descriptorArray = serializeDescriptor(detection.descriptor);

				// Check if similar to a recently queried UNMATCHED face (avoid spam for unknown people)
				// Note: This does NOT block matched/known faces - those are handled by per-user cooldown
				if (isSimilarToRecentUnmatched(descriptorArray)) {
					return;
				}

				// Rate limit uncertain queries (only applies if last query was a no-match)
				const now = Date.now();
				const timeSinceLastUncertain = now - lastUncertainQueryRef.current;
				if (
					lastUncertainQueryRef.current > 0 &&
					timeSinceLastUncertain < UNCERTAIN_QUERY_COOLDOWN_MS
				) {
					console.log(
						"[useFaceId] Rate limited after no-match, waiting",
						Math.round(
							(UNCERTAIN_QUERY_COOLDOWN_MS - timeSinceLastUncertain) / 1000,
						),
						"s",
					);
					return;
				}

				isMatchingRef.current = true;

				try {
					// Send to server for matching
					console.log(
						"[useFaceId] Sending face to server (confidence:",
						detection.confidence.toFixed(3),
						")",
					);
					const result = await trpc.faceId.matchFace.mutate({
						faceDescriptor: descriptorArray,
					});

					if (result.matched && result.user) {
						// Server found a match - this is a known/enrolled face
						// Clear uncertain timestamp since we got a match
						lastUncertainQueryRef.current = 0;

						// Check confidence threshold for triggering callback
						if (result.confidence < MIN_MATCH_CONFIDENCE) {
							console.log(
								"[useFaceId] Face matched but confidence too low:",
								result.confidence.toFixed(3),
								"<",
								MIN_MATCH_CONFIDENCE,
								"- user:",
								result.user.name,
							);
							// Don't add to unmatched cache - this IS a known user, just low confidence
							return;
						}

						// Check if this user is in cooldown
						if (isUserInCooldown(result.user.id)) {
							console.log(
								"[useFaceId] User",
								result.user.id,
								"is in cooldown, skipping callback",
							);
							// Don't add to unmatched cache - this is a known user
							return;
						}

						console.log("[useFaceId] Face matched!", {
							userId: result.user.id,
							userName: result.user.name,
							confidence: result.confidence.toFixed(3),
							distance: result.distance.toFixed(3),
						});

						// Set cooldown for this user FIRST (before callback)
						setCooldownForUser(result.user.id);

						// Trigger match callback
						onMatch?.({
							userId: result.user.id,
							userName: result.user.name,
							cardNumber: result.user.cardNumber,
							confidence: result.confidence,
						});
					} else {
						// No match - this is an unknown/unenrolled face
						// Add to unmatched cache to avoid re-querying the same unknown person
						addToUnmatchedCache(descriptorArray);
						// Track for rate limiting
						lastUncertainQueryRef.current = now;
						console.log(
							"[useFaceId] No match (distance:",
							result.distance.toFixed(3),
							", confidence:",
							result.confidence.toFixed(3),
							")",
						);
					}
				} finally {
					isMatchingRef.current = false;
				}
			}
		} catch (err) {
			isMatchingRef.current = false;
			console.error("[useFaceId] Scan error:", err);
		}
	}, [
		videoRef,
		onMatch,
		isUserInCooldown,
		setCooldownForUser,
		isSimilarToRecentUnmatched,
		addToUnmatchedCache,
	]);

	// Start/stop scanning
	const startScanning = useCallback(() => {
		if (status !== "ready" || isScanning) {
			console.log("[useFaceId] Cannot start scanning:", { status, isScanning });
			return;
		}

		console.log(
			"[useFaceId] Starting face scanning, enrolled count:",
			enrolledCountRef.current,
		);
		setIsScanning(true);
		isScanningRef.current = true;
		setStatus("scanning");

		// Reset rate limiting state
		lastUncertainQueryRef.current = 0;
		recentUnmatchedDescriptorsRef.current = [];

		// Perform an immediate scan
		void performScan();

		scanIntervalRef.current = setInterval(() => {
			void performScan();
		}, SCAN_INTERVAL_MS);
	}, [status, isScanning, performScan]);

	const stopScanning = useCallback(() => {
		console.log("[useFaceId] Stopping face scanning");
		setIsScanning(false);
		isScanningRef.current = false;
		setStatus("ready");

		if (scanIntervalRef.current) {
			clearInterval(scanIntervalRef.current);
			scanIntervalRef.current = null;
		}
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
		currentDetection,
		startScanning,
		stopScanning,
		isScanning,
		enrolledCount,
		refreshEnrolledFaces,
		lastMatchedUserId,
		isCooldownActive: lastMatchedUserId !== null,
	};
}
