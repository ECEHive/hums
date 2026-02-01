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
		eventType: "TAP" | "FACE_ID" | "FACE_ID_ENROLLMENT",
		userId?: number,
	) => Promise<void>;

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

	// Capture security snapshot
	const captureSecuritySnapshot = useCallback(
		async (
			eventType: "TAP" | "FACE_ID" | "FACE_ID_ENROLLMENT",
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
