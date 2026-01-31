/**
 * Face API Service for the Kiosk application
 * Handles face detection, descriptor extraction, and face matching
 * Uses @vladmandic/face-api for browser-based face recognition
 */

import * as faceapi from "@vladmandic/face-api";

// Model URLs - use the official face-api.js models from jsdelivr CDN
const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model";

// Configuration
const DETECTION_OPTIONS = new faceapi.SsdMobilenetv1Options({
	minConfidence: 0.5,
	maxResults: 1,
});

// Face matching threshold (lower = more strict)
const FACE_MATCH_THRESHOLD = 0.6;

// Minimum face detection confidence for enrollment
const MIN_ENROLLMENT_CONFIDENCE = 0.8;

let modelsLoaded = false;

/**
 * Load all required face-api models
 */
export async function loadFaceApiModels(): Promise<void> {
	if (modelsLoaded) {
		return;
	}

	try {
		// Set up TensorFlow.js backend using dynamic access to avoid type issues
		const tf = faceapi.tf as unknown as {
			setBackend: (backend: string) => Promise<boolean>;
			ready: () => Promise<void>;
			env: () => {
				set: (flag: string, value: boolean) => void;
				flagRegistry: Record<string, unknown>;
			};
		};

		await tf.setBackend("webgl");
		await tf.ready();

		// Enable optimizations
		const envApi = tf.env();
		if (envApi.flagRegistry.CANVAS2D_WILL_READ_FREQUENTLY) {
			envApi.set("CANVAS2D_WILL_READ_FREQUENTLY", true);
		}
		if (envApi.flagRegistry.WEBGL_EXP_CONV) {
			envApi.set("WEBGL_EXP_CONV", true);
		}

		// Load required models
		await Promise.all([
			faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
			faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
			faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
			faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
		]);

		modelsLoaded = true;
		console.log("[FaceAPI] Models loaded successfully");
	} catch (error) {
		console.error("[FaceAPI] Failed to load models:", error);
		throw new Error("Failed to load face detection models");
	}
}

/**
 * Check if models are loaded
 */
export function areModelsLoaded(): boolean {
	return modelsLoaded;
}

/**
 * Result of face detection
 */
export interface FaceDetectionResult {
	detected: boolean;
	confidence: number;
	descriptor: Float32Array | null;
	box: {
		x: number;
		y: number;
		width: number;
		height: number;
	} | null;
	/** Estimated head yaw angle in degrees (-90 to 90, negative = looking left) */
	yawAngle: number | null;
	/** Detected expression and confidence */
	expression: {
		type: string;
		confidence: number;
	} | null;
}

/**
 * Estimate head yaw angle from facial landmarks
 * Uses the nose tip and outer eye corners to estimate horizontal rotation
 */
function estimateYawAngle(landmarks: faceapi.FaceLandmarks68): number {
	// Get key points for yaw estimation
	const nose = landmarks.getNose();
	const leftEye = landmarks.getLeftEye();
	const rightEye = landmarks.getRightEye();

	// Get the nose tip (middle of nose array)
	const noseTip = nose[3]; // Point 30 in 68-point model

	// Get outer corners of eyes
	const leftEyeOuter = leftEye[0]; // Point 36
	const rightEyeOuter = rightEye[3]; // Point 45

	// Calculate face width from eye corners
	const faceWidth = rightEyeOuter.x - leftEyeOuter.x;

	// Calculate center of eyes
	const eyesCenterX = (leftEyeOuter.x + rightEyeOuter.x) / 2;

	// Nose deviation from eye center indicates yaw
	const noseDeviation = noseTip.x - eyesCenterX;

	// Normalize to approximate angle
	// When face is turned 45 degrees, nose is about 1/4 of face width from center
	const normalizedDeviation = noseDeviation / (faceWidth * 0.5);

	// Convert to approximate degrees (clamped to reasonable range)
	// Note: We negate the angle because the video is typically mirrored (scale-x: -1)
	// so user turning left appears as turning right in raw video
	const yawAngle = Math.max(-45, Math.min(45, -normalizedDeviation * 45));

	return yawAngle;
}

/**
 * Detect a face in the given input (image, video, or canvas element)
 * Basic detection without expression analysis
 */
export async function detectFace(
	input: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
): Promise<FaceDetectionResult> {
	if (!modelsLoaded) {
		console.warn("[FaceAPI] detectFace called but models not loaded");
		throw new Error("Face API models not loaded");
	}

	try {
		const detection = await faceapi
			.detectSingleFace(input, DETECTION_OPTIONS)
			.withFaceLandmarks()
			.withFaceDescriptor();

		if (!detection) {
			console.log("[FaceAPI] No face detected in frame");
			return {
				detected: false,
				confidence: 0,
				descriptor: null,
				box: null,
				yawAngle: null,
				expression: null,
			};
		}

		// Estimate head yaw angle from landmarks
		const yawAngle = estimateYawAngle(detection.landmarks);

		return {
			detected: true,
			confidence: detection.detection.score,
			descriptor: detection.descriptor,
			box: {
				x: detection.detection.box.x,
				y: detection.detection.box.y,
				width: detection.detection.box.width,
				height: detection.detection.box.height,
			},
			yawAngle,
			expression: null,
		};
	} catch (error) {
		console.error("[FaceAPI] Detection error:", error);
		return {
			detected: false,
			confidence: 0,
			descriptor: null,
			box: null,
			yawAngle: null,
			expression: null,
		};
	}
}

/**
 * Detect a face with expression analysis
 * Used for enrollment to ensure neutral expression
 */
export async function detectFaceWithExpression(
	input: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
): Promise<FaceDetectionResult> {
	if (!modelsLoaded) {
		console.warn(
			"[FaceAPI] detectFaceWithExpression called but models not loaded",
		);
		throw new Error("Face API models not loaded");
	}

	try {
		const inputWidth =
			"videoWidth" in input
				? input.videoWidth
				: "naturalWidth" in input
					? input.naturalWidth
					: input.width;
		const inputHeight =
			"videoHeight" in input
				? input.videoHeight
				: "naturalHeight" in input
					? input.naturalHeight
					: input.height;
		console.log("[FaceAPI] detectFaceWithExpression input:", {
			type: input.tagName,
			width: inputWidth,
			height: inputHeight,
		});

		const detection = await faceapi
			.detectSingleFace(input, DETECTION_OPTIONS)
			.withFaceLandmarks()
			.withFaceDescriptor()
			.withFaceExpressions();

		if (!detection) {
			return {
				detected: false,
				confidence: 0,
				descriptor: null,
				box: null,
				yawAngle: null,
				expression: null,
			};
		}

		// Estimate head yaw angle from landmarks
		const yawAngle = estimateYawAngle(detection.landmarks);

		// Find dominant expression
		const expressions = detection.expressions;
		const expressionEntries = Object.entries(expressions) as [string, number][];
		const dominantExpression = expressionEntries.reduce((max, current) =>
			current[1] > max[1] ? current : max,
		);

		return {
			detected: true,
			confidence: detection.detection.score,
			descriptor: detection.descriptor,
			box: {
				x: detection.detection.box.x,
				y: detection.detection.box.y,
				width: detection.detection.box.width,
				height: detection.detection.box.height,
			},
			yawAngle,
			expression: {
				type: dominantExpression[0],
				confidence: dominantExpression[1],
			},
		};
	} catch (error) {
		console.error("[FaceAPI] Detection error:", error);
		return {
			detected: false,
			confidence: 0,
			descriptor: null,
			box: null,
			yawAngle: null,
			expression: null,
		};
	}
}

/**
 * Check if a face detection is good enough for enrollment
 */
export function isEnrollmentQuality(result: FaceDetectionResult): boolean {
	return result.detected && result.confidence >= MIN_ENROLLMENT_CONFIDENCE;
}

/**
 * Compare two face descriptors and return the distance
 * Lower distance = more similar faces
 */
export function compareFaceDescriptors(
	descriptor1: Float32Array,
	descriptor2: Float32Array,
): number {
	return faceapi.euclideanDistance(descriptor1, descriptor2);
}

/**
 * Check if two faces match based on their descriptors
 */
export function doFacesMatch(
	descriptor1: Float32Array,
	descriptor2: Float32Array,
	threshold: number = FACE_MATCH_THRESHOLD,
): boolean {
	const distance = compareFaceDescriptors(descriptor1, descriptor2);
	return distance <= threshold;
}

/**
 * Serialize a face descriptor to JSON-compatible format
 */
export function serializeDescriptor(descriptor: Float32Array): number[] {
	return Array.from(descriptor);
}

/**
 * Deserialize a face descriptor from JSON format
 */
export function deserializeDescriptor(data: number[]): Float32Array {
	return new Float32Array(data);
}

/**
 * Find the best matching face from a list of enrolled faces
 */
export interface EnrolledFace {
	userId: number;
	userName: string;
	descriptor: Float32Array;
}

export interface FaceMatchResult {
	matched: boolean;
	userId: number | null;
	userName: string | null;
	distance: number;
	confidence: number;
}

export function findBestMatch(
	targetDescriptor: Float32Array,
	enrolledFaces: EnrolledFace[],
	threshold: number = FACE_MATCH_THRESHOLD,
): FaceMatchResult {
	if (enrolledFaces.length === 0) {
		return {
			matched: false,
			userId: null,
			userName: null,
			distance: Infinity,
			confidence: 0,
		};
	}

	let bestMatch: EnrolledFace | null = null;
	let bestDistance = Infinity;

	for (const face of enrolledFaces) {
		const distance = compareFaceDescriptors(targetDescriptor, face.descriptor);
		if (distance < bestDistance) {
			bestDistance = distance;
			bestMatch = face;
		}
	}

	if (bestMatch && bestDistance <= threshold) {
		// Convert distance to confidence (0-1 range, higher is better)
		const confidence = Math.max(0, 1 - bestDistance / threshold);
		return {
			matched: true,
			userId: bestMatch.userId,
			userName: bestMatch.userName,
			distance: bestDistance,
			confidence,
		};
	}

	return {
		matched: false,
		userId: null,
		userName: null,
		distance: bestDistance,
		confidence: 0,
	};
}

/**
 * Capture a snapshot from a video element
 */
export function captureSnapshot(
	video: HTMLVideoElement,
	quality: number = 0.8,
): string {
	console.log("[face-api] captureSnapshot called, video dimensions:", {
		videoWidth: video.videoWidth,
		videoHeight: video.videoHeight,
		readyState: video.readyState,
	});

	if (video.videoWidth === 0 || video.videoHeight === 0) {
		throw new Error(
			"Video element has no dimensions - video may not be playing",
		);
	}

	const canvas = document.createElement("canvas");
	canvas.width = video.videoWidth;
	canvas.height = video.videoHeight;

	const ctx = canvas.getContext("2d");
	if (!ctx) {
		throw new Error("Failed to get canvas context");
	}

	ctx.drawImage(video, 0, 0);
	const dataUrl = canvas.toDataURL("image/jpeg", quality);
	console.log("[face-api] Snapshot captured, data URL length:", dataUrl.length);
	return dataUrl;
}

/**
 * Convert a data URL to a Blob for upload
 */
export function dataUrlToBlob(dataUrl: string): Blob {
	const parts = dataUrl.split(",");
	const mime = parts[0]?.match(/:(.*?);/)?.[1] ?? "image/jpeg";
	const bstr = atob(parts[1] ?? "");
	let n = bstr.length;
	const u8arr = new Uint8Array(n);
	while (n--) {
		u8arr[n] = bstr.charCodeAt(n);
	}
	return new Blob([u8arr], { type: mime });
}

/**
 * Convert FaceDetectionResult to format suitable for FaceTracker
 */
export function toTrackerDetection(result: FaceDetectionResult): {
	box: { x: number; y: number; width: number; height: number };
	confidence: number;
	descriptor: number[] | null;
	yawAngle: number | null;
} | null {
	if (!result.detected || !result.box) {
		return null;
	}

	return {
		box: result.box,
		confidence: result.confidence,
		descriptor: result.descriptor
			? serializeDescriptor(result.descriptor)
			: null,
		yawAngle: result.yawAngle,
	};
}

/**
 * Get video dimensions from a video element
 */
export function getVideoDimensions(
	video: HTMLVideoElement,
): { width: number; height: number } | null {
	if (video.videoWidth === 0 || video.videoHeight === 0) {
		return null;
	}
	return {
		width: video.videoWidth,
		height: video.videoHeight,
	};
}

// Re-export faceapi for drawing utilities if needed
export { faceapi };
