/**
 * useCamera hook for managing webcam access and snapshots
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { captureSnapshot, dataUrlToBlob } from "@/lib/face-api";

export type CameraStatus =
	| "idle"
	| "requesting"
	| "active"
	| "error"
	| "unavailable";

export interface CameraConfig {
	/** Preferred facing mode */
	facingMode?: "user" | "environment";
	/** Preferred video width */
	width?: number;
	/** Preferred video height */
	height?: number;
	/** Whether to start immediately on mount */
	autoStart?: boolean;
}

export interface UseCameraResult {
	/** Reference to attach to video element */
	videoRef: React.RefObject<HTMLVideoElement | null>;
	/** Current camera status */
	status: CameraStatus;
	/** Error message if any */
	error: string | null;
	/** Start the camera stream */
	start: () => Promise<void>;
	/** Stop the camera stream */
	stop: () => void;
	/** Capture a snapshot as data URL */
	captureDataUrl: (quality?: number) => string | null;
	/** Capture a snapshot as Blob for upload */
	captureBlob: (quality?: number) => Blob | null;
	/** Whether the camera is ready for capture */
	isReady: boolean;
	/** Video dimensions once ready */
	dimensions: { width: number; height: number } | null;
}

const DEFAULT_CONFIG: Required<CameraConfig> = {
	facingMode: "user",
	width: 1280,
	height: 720,
	autoStart: false,
};

export function useCamera(config: CameraConfig = {}): UseCameraResult {
	const mergedConfig = { ...DEFAULT_CONFIG, ...config };
	const videoRef = useRef<HTMLVideoElement | null>(null);
	const streamRef = useRef<MediaStream | null>(null);

	const [status, setStatus] = useState<CameraStatus>("idle");
	const [error, setError] = useState<string | null>(null);
	const [isReady, setIsReady] = useState(false);
	const [dimensions, setDimensions] = useState<{
		width: number;
		height: number;
	} | null>(null);

	const stop = useCallback(() => {
		if (streamRef.current) {
			for (const track of streamRef.current.getTracks()) {
				track.stop();
			}
			streamRef.current = null;
		}

		if (videoRef.current) {
			videoRef.current.srcObject = null;
		}

		setStatus("idle");
		setIsReady(false);
		setDimensions(null);
	}, []);

	const start = useCallback(async () => {
		console.log("[useCamera] Starting camera...");

		// Check if getUserMedia is available
		if (!navigator.mediaDevices?.getUserMedia) {
			console.error("[useCamera] getUserMedia not available");
			setStatus("unavailable");
			setError("Camera access is not supported in this browser");
			return;
		}

		// Stop any existing stream
		stop();

		setStatus("requesting");
		setError(null);

		try {
			const constraints: MediaStreamConstraints = {
				video: {
					facingMode: mergedConfig.facingMode,
					width: { ideal: mergedConfig.width },
					height: { ideal: mergedConfig.height },
				},
				audio: false,
			};

			const stream = await navigator.mediaDevices.getUserMedia(constraints);
			streamRef.current = stream;

			if (videoRef.current) {
				videoRef.current.srcObject = stream;

				// Wait for video to be ready
				await new Promise<void>((resolve, reject) => {
					const video = videoRef.current;
					if (!video) {
						reject(new Error("Video element not available"));
						return;
					}

					const onLoadedMetadata = () => {
						video.removeEventListener("loadedmetadata", onLoadedMetadata);
						video.removeEventListener("error", onError);
						resolve();
					};

					const onError = () => {
						video.removeEventListener("loadedmetadata", onLoadedMetadata);
						video.removeEventListener("error", onError);
						reject(new Error("Failed to load video"));
					};

					video.addEventListener("loadedmetadata", onLoadedMetadata);
					video.addEventListener("error", onError);
				});

				await videoRef.current.play();
				console.log("[useCamera] Video playing, dimensions:", {
					width: videoRef.current.videoWidth,
					height: videoRef.current.videoHeight,
				});

				setDimensions({
					width: videoRef.current.videoWidth,
					height: videoRef.current.videoHeight,
				});
				setStatus("active");
				setIsReady(true);
				console.log("[useCamera] Camera ready");
			}
		} catch (err) {
			console.error("[useCamera] Failed to start camera:", err);
			const message =
				err instanceof Error ? err.message : "Failed to access camera";

			if (
				message.includes("Permission denied") ||
				message.includes("NotAllowedError")
			) {
				setError("Camera permission denied. Please allow camera access.");
			} else if (
				message.includes("NotFoundError") ||
				message.includes("DevicesNotFoundError")
			) {
				setError("No camera found on this device.");
				setStatus("unavailable");
				return;
			} else {
				setError(message);
			}

			setStatus("error");
		}
	}, [mergedConfig.facingMode, mergedConfig.width, mergedConfig.height, stop]);

	const captureDataUrl = useCallback(
		(quality: number = 0.8): string | null => {
			if (!isReady || !videoRef.current) {
				return null;
			}

			try {
				return captureSnapshot(videoRef.current, quality);
			} catch (err) {
				console.error("[useCamera] Failed to capture snapshot:", err);
				return null;
			}
		},
		[isReady],
	);

	const captureBlob = useCallback(
		(quality: number = 0.8): Blob | null => {
			const dataUrl = captureDataUrl(quality);
			if (!dataUrl) {
				return null;
			}

			try {
				return dataUrlToBlob(dataUrl);
			} catch (err) {
				console.error("[useCamera] Failed to convert to blob:", err);
				return null;
			}
		},
		[captureDataUrl],
	);

	// Auto-start if configured
	useEffect(() => {
		if (mergedConfig.autoStart) {
			void start();
		}
	}, [mergedConfig.autoStart, start]);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			stop();
		};
	}, [stop]);

	return {
		videoRef,
		status,
		error,
		start,
		stop,
		captureDataUrl,
		captureBlob,
		isReady,
		dimensions,
	};
}
