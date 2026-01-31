/**
 * Face Tracker - Stateful face tracking for intelligent identification
 *
 * This module implements a state-driven approach to face identification that:
 * - Tracks individual faces across frames
 * - Requires temporal stability before attempting identification
 * - Suppresses repeated identification attempts for the same face
 * - Distinguishes between new and existing faces
 *
 * Face Lifecycle States:
 * - DETECTED: Face is present but not yet qualified for identification
 * - QUALIFIED: Face meets quality criteria and has been stable long enough
 * - ATTEMPTED: An identification request has been made
 * - SUPPRESSED: Further attempts are paused (after successful match or failure)
 * - EXPIRED: Face has left the scene
 */

// ============================================================================
// Configuration Constants
// ============================================================================

/** Minimum face width relative to video width (0-1) for eligibility */
export const MIN_FACE_SIZE_RATIO = 0.06;

/** Minimum detection confidence for eligibility */
export const MIN_DETECTION_CONFIDENCE = 0.6;

/** Maximum absolute yaw angle (degrees) for eligibility - rejects faces looking too far away */
export const MAX_YAW_ANGLE = 30;

/** Duration (ms) a face must be continuously visible before qualifying for identification */
export const STABILITY_DURATION_MS = 100;

/** Maximum position drift (as ratio of face size) between frames to maintain stability */
export const MAX_POSITION_DRIFT_RATIO = 0.8;

/** Maximum size change ratio between frames to maintain stability */
export const MAX_SIZE_CHANGE_RATIO = 0.6;

/** Duration (ms) to suppress identification attempts after a successful match */
export const MATCH_SUPPRESSION_DURATION_MS = 10000;

/** Duration (ms) to suppress identification attempts after a failed match (no match found) */
export const NO_MATCH_SUPPRESSION_DURATION_MS = 3000;

/** Duration (ms) after which a face is considered expired if not seen */
export const FACE_EXPIRY_DURATION_MS = 2000;

/** Maximum distance threshold to consider two faces as the same person across frames */
export const FACE_TRACKING_DISTANCE_THRESHOLD = 0.5;

/** Descriptor similarity threshold for matching tracked faces (Euclidean distance) */
export const DESCRIPTOR_SIMILARITY_THRESHOLD = 0.65;

/** Minimum number of stable frames required before qualifying */
export const MIN_STABLE_FRAMES = 1;

// ============================================================================
// Types
// ============================================================================

export type FaceState =
	| "detected"
	| "qualified"
	| "attempted"
	| "suppressed"
	| "expired";

export interface FaceBox {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface TrackedFaceData {
	id: string;
	state: FaceState;
	box: FaceBox;
	confidence: number;
	descriptor: number[] | null;
	yawAngle: number | null;
	firstSeenAt: number;
	lastSeenAt: number;
	stableStartAt: number | null;
	stableFrameCount: number;
	attemptedAt: number | null;
	matchedUserId: number | null;
	suppressedUntil: number | null;
}

export interface EligibilityResult {
	eligible: boolean;
	reasons: string[];
}

export interface QualificationResult {
	qualified: boolean;
	reason: string;
	stableDuration: number;
	stableFrames: number;
}

// ============================================================================
// TrackedFace Class
// ============================================================================

/**
 * Represents a single tracked face with its lifecycle state
 */
export class TrackedFace {
	readonly id: string;
	private _state: FaceState = "detected";
	private _box: FaceBox;
	private _confidence: number;
	private _descriptor: number[] | null = null;
	private _yawAngle: number | null = null;
	private _firstSeenAt: number;
	private _lastSeenAt: number;
	private _stableStartAt: number | null = null;
	private _stableFrameCount: number = 0;
	private _attemptedAt: number | null = null;
	private _matchedUserId: number | null = null;
	private _suppressedUntil: number | null = null;
	private _previousBox: FaceBox | null = null;

	// Diagnostic tracking (only log on change)
	private _lastLoggedEligibilityReasons: string = "";
	private _lastLoggedQualificationReason: string = "";
	private _lastLoggedStabilityStatus: boolean | null = null;

	constructor(box: FaceBox, confidence: number, descriptor: number[] | null) {
		this.id = generateFaceId();
		this._box = box;
		this._confidence = confidence;
		this._descriptor = descriptor;
		this._firstSeenAt = Date.now();
		this._lastSeenAt = this._firstSeenAt;
	}

	// Getters
	get state(): FaceState {
		return this._state;
	}
	get box(): FaceBox {
		return this._box;
	}
	get confidence(): number {
		return this._confidence;
	}
	get descriptor(): number[] | null {
		return this._descriptor;
	}
	get yawAngle(): number | null {
		return this._yawAngle;
	}
	get firstSeenAt(): number {
		return this._firstSeenAt;
	}
	get lastSeenAt(): number {
		return this._lastSeenAt;
	}
	get stableFrameCount(): number {
		return this._stableFrameCount;
	}
	get matchedUserId(): number | null {
		return this._matchedUserId;
	}
	get attemptedAt(): number | null {
		return this._attemptedAt;
	}

	/**
	 * Update the face with new detection data
	 */
	update(
		box: FaceBox,
		confidence: number,
		descriptor: number[] | null,
		yawAngle: number | null,
		videoDimensions: { width: number; height: number },
	): void {
		const now = Date.now();
		this._previousBox = { ...this._box };
		this._box = box;
		this._confidence = confidence;
		this._yawAngle = yawAngle;
		this._lastSeenAt = now;

		// Update descriptor if we got a better one
		if (descriptor && (!this._descriptor || confidence > this._confidence)) {
			this._descriptor = descriptor;
		}

		// Check eligibility for this update
		const eligibility = this.checkEligibility(videoDimensions);

		// Log eligibility changes only
		const eligibilityReasonsStr = eligibility.reasons.join("; ");
		if (eligibilityReasonsStr !== this._lastLoggedEligibilityReasons) {
			if (!eligibility.eligible) {
				console.log(
					`[FaceTracker] Face ${this.id.slice(0, 8)} NOT ELIGIBLE: ${eligibilityReasonsStr}`,
				);
			} else if (this._lastLoggedEligibilityReasons !== "") {
				console.log(`[FaceTracker] Face ${this.id.slice(0, 8)} now ELIGIBLE`);
			}
			this._lastLoggedEligibilityReasons = eligibilityReasonsStr;
		}

		if (eligibility.eligible) {
			// Check stability (position and size consistency)
			const stabilityResult = this.checkStabilityWithReason();

			// Log stability changes only
			if (stabilityResult.stable !== this._lastLoggedStabilityStatus) {
				if (!stabilityResult.stable) {
					console.log(
						`[FaceTracker] Face ${this.id.slice(0, 8)} UNSTABLE: ${stabilityResult.reason}`,
					);
				} else {
					console.log(`[FaceTracker] Face ${this.id.slice(0, 8)} now STABLE`);
				}
				this._lastLoggedStabilityStatus = stabilityResult.stable;
			}

			if (stabilityResult.stable) {
				if (this._stableStartAt === null) {
					this._stableStartAt = now;
				}
				this._stableFrameCount++;
			} else {
				// Reset stability tracking
				this._stableStartAt = null;
				this._stableFrameCount = 0;
			}
		} else {
			// Not eligible - reset stability
			this._stableStartAt = null;
			this._stableFrameCount = 0;
			this._lastLoggedStabilityStatus = null;
		}

		// Update state based on current conditions
		this.updateState(eligibility);
	}

	/**
	 * Check if this face meets basic eligibility criteria
	 */
	checkEligibility(videoDimensions: {
		width: number;
		height: number;
	}): EligibilityResult {
		const reasons: string[] = [];

		// Check face size relative to video
		const faceSizeRatio = this._box.width / videoDimensions.width;
		if (faceSizeRatio < MIN_FACE_SIZE_RATIO) {
			reasons.push(
				`Face too small: ${(faceSizeRatio * 100).toFixed(1)}% < ${(MIN_FACE_SIZE_RATIO * 100).toFixed(0)}% of frame`,
			);
		}

		// Check detection confidence
		if (this._confidence < MIN_DETECTION_CONFIDENCE) {
			reasons.push(
				`Low confidence: ${(this._confidence * 100).toFixed(0)}% < ${(MIN_DETECTION_CONFIDENCE * 100).toFixed(0)}%`,
			);
		}

		// Check head pose (yaw angle)
		if (this._yawAngle !== null && Math.abs(this._yawAngle) > MAX_YAW_ANGLE) {
			reasons.push(
				`Head turned too far: ${this._yawAngle.toFixed(0)}° (max ±${MAX_YAW_ANGLE}°)`,
			);
		}

		// Check if we have a descriptor
		if (!this._descriptor) {
			reasons.push("No face descriptor available");
		}

		return {
			eligible: reasons.length === 0,
			reasons,
		};
	}

	/**
	 * Check if the face position/size is stable between frames
	 */
	private checkStabilityWithReason(): { stable: boolean; reason: string } {
		if (!this._previousBox) {
			return { stable: true, reason: "First frame" }; // First frame, consider stable
		}

		const avgSize = (this._box.width + this._previousBox.width) / 2;

		// Check position drift
		const centerX = this._box.x + this._box.width / 2;
		const centerY = this._box.y + this._box.height / 2;
		const prevCenterX = this._previousBox.x + this._previousBox.width / 2;
		const prevCenterY = this._previousBox.y + this._previousBox.height / 2;

		const positionDrift = Math.sqrt(
			(centerX - prevCenterX) ** 2 + (centerY - prevCenterY) ** 2,
		);
		const positionDriftRatio = positionDrift / avgSize;

		if (positionDriftRatio > MAX_POSITION_DRIFT_RATIO) {
			return {
				stable: false,
				reason: `Position drift: ${(positionDriftRatio * 100).toFixed(1)}% > ${(MAX_POSITION_DRIFT_RATIO * 100).toFixed(0)}% of face size`,
			};
		}

		// Check size change
		const sizeChange = Math.abs(this._box.width - this._previousBox.width);
		const sizeChangeRatio = sizeChange / avgSize;

		if (sizeChangeRatio > MAX_SIZE_CHANGE_RATIO) {
			return {
				stable: false,
				reason: `Size change: ${(sizeChangeRatio * 100).toFixed(1)}% > ${(MAX_SIZE_CHANGE_RATIO * 100).toFixed(0)}%`,
			};
		}

		return { stable: true, reason: "Stable" };
	}

	/**
	 * Update the face's state based on current conditions
	 */
	private updateState(eligibility: EligibilityResult): void {
		const now = Date.now();

		// Check if suppression has expired
		if (this._state === "suppressed" && this._suppressedUntil !== null) {
			if (now >= this._suppressedUntil) {
				// Suppression expired - can try again if qualified
				this._state = "detected";
				this._suppressedUntil = null;
			} else {
				return; // Still suppressed
			}
		}

		// If already attempted and waiting, don't change state
		if (this._state === "attempted") {
			return;
		}

		// Check qualification
		const qualification = this.checkQualification(eligibility);

		// Log qualification status changes
		if (qualification.reason !== this._lastLoggedQualificationReason) {
			if (qualification.qualified) {
				console.log(
					`[FaceTracker] Face ${this.id.slice(0, 8)} QUALIFIED for identification`,
				);
			} else if (this._state === "detected") {
				console.log(
					`[FaceTracker] Face ${this.id.slice(0, 8)} not qualified: ${qualification.reason}`,
				);
			}
			this._lastLoggedQualificationReason = qualification.reason;
		}

		if (qualification.qualified && this._state === "detected") {
			this._state = "qualified";
		} else if (!eligibility.eligible && this._state === "qualified") {
			// Lost eligibility, go back to detected
			this._state = "detected";
		}
	}

	/**
	 * Check if the face meets qualification criteria for identification
	 */
	checkQualification(eligibility: EligibilityResult): QualificationResult {
		if (!eligibility.eligible) {
			return {
				qualified: false,
				reason: eligibility.reasons.join(", "),
				stableDuration: 0,
				stableFrames: this._stableFrameCount,
			};
		}

		if (this._stableStartAt === null) {
			return {
				qualified: false,
				reason: "Stability tracking not started",
				stableDuration: 0,
				stableFrames: this._stableFrameCount,
			};
		}

		const stableDuration = Date.now() - this._stableStartAt;
		const hasEnoughTime = stableDuration >= STABILITY_DURATION_MS;
		const hasEnoughFrames = this._stableFrameCount >= MIN_STABLE_FRAMES;

		if (!hasEnoughTime) {
			return {
				qualified: false,
				reason: `Needs ${STABILITY_DURATION_MS - stableDuration}ms more stability`,
				stableDuration,
				stableFrames: this._stableFrameCount,
			};
		}

		if (!hasEnoughFrames) {
			return {
				qualified: false,
				reason: `Needs ${MIN_STABLE_FRAMES - this._stableFrameCount} more stable frames`,
				stableDuration,
				stableFrames: this._stableFrameCount,
			};
		}

		return {
			qualified: true,
			reason: "Face is stable and eligible",
			stableDuration,
			stableFrames: this._stableFrameCount,
		};
	}

	/**
	 * Mark that an identification attempt is in progress
	 */
	markAttempted(): void {
		this._state = "attempted";
		this._attemptedAt = Date.now();
	}

	/**
	 * Mark successful match - suppress for longer duration
	 */
	markMatched(userId: number): void {
		this._state = "suppressed";
		this._matchedUserId = userId;
		this._suppressedUntil = Date.now() + MATCH_SUPPRESSION_DURATION_MS;
	}

	/**
	 * Mark failed match (no user found) - suppress for shorter duration
	 */
	markNoMatch(): void {
		this._state = "suppressed";
		this._suppressedUntil = Date.now() + NO_MATCH_SUPPRESSION_DURATION_MS;
	}

	/**
	 * Check if this face has expired (not seen recently)
	 */
	isExpired(): boolean {
		return Date.now() - this._lastSeenAt > FACE_EXPIRY_DURATION_MS;
	}

	/**
	 * Check if this face is ready for identification attempt
	 */
	isReadyForIdentification(): boolean {
		return this._state === "qualified" && this._descriptor !== null;
	}

	/**
	 * Export face data for debugging/logging
	 */
	toData(): TrackedFaceData {
		return {
			id: this.id,
			state: this._state,
			box: this._box,
			confidence: this._confidence,
			descriptor: this._descriptor,
			yawAngle: this._yawAngle,
			firstSeenAt: this._firstSeenAt,
			lastSeenAt: this._lastSeenAt,
			stableStartAt: this._stableStartAt,
			stableFrameCount: this._stableFrameCount,
			attemptedAt: this._attemptedAt,
			matchedUserId: this._matchedUserId,
			suppressedUntil: this._suppressedUntil,
		};
	}
}

// ============================================================================
// FaceTracker Manager Class
// ============================================================================

export interface FaceTrackerEvents {
	onFaceQualified?: (face: TrackedFace) => void;
	onFaceExpired?: (face: TrackedFace) => void;
	onFaceMatched?: (face: TrackedFace, userId: number) => void;
}

/**
 * Manages tracking of multiple faces across frames
 */
export class FaceTracker {
	private faces: Map<string, TrackedFace> = new Map();
	private events: FaceTrackerEvents;
	private videoDimensions: { width: number; height: number } = {
		width: 640,
		height: 480,
	};

	constructor(events: FaceTrackerEvents = {}) {
		this.events = events;
	}

	/**
	 * Set video dimensions for eligibility calculations
	 */
	setVideoDimensions(width: number, height: number): void {
		this.videoDimensions = { width, height };
	}

	/**
	 * Process a new frame of detections
	 */
	processFrame(
		detections: Array<{
			box: FaceBox;
			confidence: number;
			descriptor: number[] | null;
			yawAngle: number | null;
		}>,
	): TrackedFace[] {
		const matchedFaceIds = new Set<string>();
		const qualifiedFaces: TrackedFace[] = [];

		// Match detections to existing tracked faces
		for (const detection of detections) {
			const matchedFace = this.findMatchingFace(detection);

			if (matchedFace) {
				// Update existing tracked face
				matchedFace.update(
					detection.box,
					detection.confidence,
					detection.descriptor,
					detection.yawAngle,
					this.videoDimensions,
				);
				matchedFaceIds.add(matchedFace.id);

				// Check if newly qualified
				if (matchedFace.isReadyForIdentification()) {
					qualifiedFaces.push(matchedFace);
					this.events.onFaceQualified?.(matchedFace);
				}
			} else {
				// New face detected
				const newFace = new TrackedFace(
					detection.box,
					detection.confidence,
					detection.descriptor,
				);
				newFace.update(
					detection.box,
					detection.confidence,
					detection.descriptor,
					detection.yawAngle,
					this.videoDimensions,
				);
				this.faces.set(newFace.id, newFace);
			}
		}

		// Check for expired faces
		const expiredIds: string[] = [];
		for (const [id, face] of this.faces) {
			if (!matchedFaceIds.has(id) && face.isExpired()) {
				expiredIds.push(id);
				this.events.onFaceExpired?.(face);
			}
		}

		// Remove expired faces
		for (const id of expiredIds) {
			this.faces.delete(id);
		}

		return qualifiedFaces;
	}

	/**
	 * Find an existing tracked face that matches the detection
	 */
	private findMatchingFace(detection: {
		box: FaceBox;
		confidence: number;
		descriptor: number[] | null;
	}): TrackedFace | null {
		let bestMatch: TrackedFace | null = null;
		let bestScore = Infinity;

		for (const face of this.faces.values()) {
			// Skip expired faces
			if (face.isExpired()) continue;

			// Calculate spatial distance (center-to-center normalized by face size)
			const centerX = detection.box.x + detection.box.width / 2;
			const centerY = detection.box.y + detection.box.height / 2;
			const faceCenterX = face.box.x + face.box.width / 2;
			const faceCenterY = face.box.y + face.box.height / 2;
			const avgSize = (detection.box.width + face.box.width) / 2;

			const spatialDistance =
				Math.sqrt((centerX - faceCenterX) ** 2 + (centerY - faceCenterY) ** 2) /
				avgSize;

			// If close enough spatially
			if (spatialDistance < FACE_TRACKING_DISTANCE_THRESHOLD) {
				// Use descriptor similarity if both have descriptors
				if (detection.descriptor && face.descriptor) {
					const descriptorDistance = euclideanDistance(
						detection.descriptor,
						face.descriptor,
					);
					// Weight: 70% spatial, 30% descriptor
					const combinedScore =
						spatialDistance * 0.7 + descriptorDistance * 0.3;

					if (combinedScore < bestScore) {
						bestScore = combinedScore;
						bestMatch = face;
					}
				} else if (spatialDistance < bestScore) {
					bestScore = spatialDistance;
					bestMatch = face;
				}
			}
		}

		return bestMatch;
	}

	/**
	 * Get a face ready for identification (if any)
	 */
	getFaceReadyForIdentification(): TrackedFace | null {
		for (const face of this.faces.values()) {
			if (face.isReadyForIdentification()) {
				return face;
			}
		}
		return null;
	}

	/**
	 * Get all currently tracked faces
	 */
	getAllFaces(): TrackedFace[] {
		return Array.from(this.faces.values());
	}

	/**
	 * Get faces by state
	 */
	getFacesByState(state: FaceState): TrackedFace[] {
		return Array.from(this.faces.values()).filter((f) => f.state === state);
	}

	/**
	 * Mark a face as matched
	 */
	markFaceMatched(faceId: string, userId: number): void {
		const face = this.faces.get(faceId);
		if (face) {
			face.markMatched(userId);
			this.events.onFaceMatched?.(face, userId);
		}
	}

	/**
	 * Mark a face as no match found
	 */
	markFaceNoMatch(faceId: string): void {
		const face = this.faces.get(faceId);
		if (face) {
			face.markNoMatch();
		}
	}

	/**
	 * Mark a face as attempted
	 */
	markFaceAttempted(faceId: string): void {
		const face = this.faces.get(faceId);
		if (face) {
			face.markAttempted();
		}
	}

	/**
	 * Clear all tracked faces
	 */
	clear(): void {
		this.faces.clear();
	}

	/**
	 * Get tracker stats for debugging
	 */
	getStats(): {
		totalFaces: number;
		byState: Record<FaceState, number>;
	} {
		const byState: Record<FaceState, number> = {
			detected: 0,
			qualified: 0,
			attempted: 0,
			suppressed: 0,
			expired: 0,
		};

		for (const face of this.faces.values()) {
			byState[face.state]++;
		}

		return {
			totalFaces: this.faces.size,
			byState,
		};
	}
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate a unique face ID
 */
function generateFaceId(): string {
	return `face_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Calculate Euclidean distance between two descriptor arrays
 */
function euclideanDistance(a: number[], b: number[]): number {
	if (a.length !== b.length) return Infinity;
	let sum = 0;
	for (let i = 0; i < a.length; i++) {
		const diff = a[i] - b[i];
		sum += diff * diff;
	}
	return Math.sqrt(sum);
}
