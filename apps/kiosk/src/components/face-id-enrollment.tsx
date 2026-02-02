/**
 * Face ID Enrollment Flow Component
 * Uses the shared camera from CameraProvider
 *
 * Features:
 * - Face centering, size, and distance validation
 * - Multiple scans for quality averaging
 * - Re-enrollment support (delete old + create new)
 */

import { trpc } from "@ecehive/trpc/client";
import {
	CheckCircle2,
	CreditCard,
	Loader2,
	Meh,
	RefreshCw,
	Save,
	XCircle,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useCameraContext } from "@/components/camera-provider";
import {
	detectFaceWithExpression,
	type FaceDetectionResult,
	isEnrollmentQuality,
	serializeDescriptor,
} from "@/lib/face-api";
import { Button } from "./ui/button";

type EnrollmentStep =
	| "card_prompt"
	| "card_verifying"
	| "existing_enrollment"
	| "camera_setup"
	| "scanning"
	| "processing"
	| "success"
	| "error";

interface EnrollmentUser {
	id: number;
	name: string;
	username: string;
}

interface FaceIdEnrollmentProps {
	onComplete?: () => void;
	onCancel?: () => void;
	onRegisterCardHandler?: (handler: (cardNumber: string) => void) => void;
}

// Face positioning requirements
const MIN_FACE_SIZE_RATIO = 0.15; // Face must be at least 15% of frame width (larger = closer)
const MAX_FACE_SIZE_RATIO = 0.75; // Face must be at most 75% of frame width
const MAX_CENTER_OFFSET_RATIO = 0.18; // Face center must be within 18% of frame center (relaxed from 15%)
const CIRCLE_RADIUS_RATIO = 0.28; // Visual circle is 28% of frame

// Head rotation limits for enrollment (degrees) - relaxed for easier enrollment
const MAX_YAW_ANGLE = 20; // Maximum horizontal rotation (left/right) - relaxed from 15°
const MAX_PITCH_ANGLE = 15; // Maximum vertical rotation (up/down) - relaxed from 12°

// Enrollment quality settings
const SCAN_INTERVAL_MS = 100; // Scanning interval for positioning check

export function FaceIdEnrollment({
	onComplete,
	onCancel,
	onRegisterCardHandler,
}: FaceIdEnrollmentProps) {
	// Use the shared camera from CameraProvider
	const camera = useCameraContext();

	const [step, setStep] = useState<EnrollmentStep>("card_prompt");
	const [error, setError] = useState<string | null>(null);
	const [user, setUser] = useState<EnrollmentUser | null>(null);
	const [faceDetection, setFaceDetection] =
		useState<FaceDetectionResult | null>(null);
	const [positioningGuide, setPositioningGuide] = useState<string>(
		"Position your face in the circle",
	);
	const [_isPositionGood, setIsPositionGood] = useState(false);
	const [emotionMessage, setEmotionMessage] = useState<string | null>(null);
	const [setupProgress, setSetupProgress] = useState<
		"camera" | "models" | "ready"
	>("camera");

	const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);
	const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
	const capturedDescriptorRef = useRef<Float32Array | null>(null);
	const cardScanHandlerRef = useRef<((cardNumber: string) => void) | null>(
		null,
	);
	const stepRef = useRef<EnrollmentStep>(step);
	const localVideoRef = useRef<HTMLVideoElement | null>(null);
	const pendingCardRef = useRef<string | null>(null);

	// Keep stepRef in sync with state
	stepRef.current = step;

	// Check if face is well-positioned (centered, sized, angle, and within circle)
	const checkFacePosition = useCallback(
		(
			detection: FaceDetectionResult,
			frameWidth: number,
			frameHeight: number,
		): {
			isValid: boolean;
			isCentered: boolean;
			isSized: boolean;
			isInCircle: boolean;
			isAngleGood: boolean;
			message: string;
		} => {
			if (!detection.detected || !detection.box) {
				return {
					isValid: false,
					isCentered: false,
					isSized: false,
					isInCircle: false,
					isAngleGood: false,
					message: "Position your face in the circle",
				};
			}

			const { box, yawAngle, pitchAngle } = detection;
			const faceCenterX = box.x + box.width / 2;
			const faceCenterY = box.y + box.height / 2;
			const frameCenterX = frameWidth / 2;
			const frameCenterY = frameHeight / 2;

			// Check centering
			const offsetX = Math.abs(faceCenterX - frameCenterX) / frameWidth;
			const offsetY = Math.abs(faceCenterY - frameCenterY) / frameHeight;
			const isCentered =
				offsetX < MAX_CENTER_OFFSET_RATIO && offsetY < MAX_CENTER_OFFSET_RATIO;

			// Check face size relative to frame (distance check)
			const faceSize = Math.max(box.width, box.height);
			const sizeRatio = faceSize / frameWidth;
			const isSized =
				sizeRatio >= MIN_FACE_SIZE_RATIO && sizeRatio <= MAX_FACE_SIZE_RATIO;

			// Check if face is within the enrollment circle
			const circleRadius =
				Math.min(frameWidth, frameHeight) * CIRCLE_RADIUS_RATIO;
			const distFromCenter = Math.sqrt(
				(faceCenterX - frameCenterX) ** 2 + (faceCenterY - frameCenterY) ** 2,
			);
			const isInCircle = distFromCenter < circleRadius * 0.8;

			// Check head rotation angles
			const yaw = yawAngle ?? 0;
			const pitch = pitchAngle ?? 0;
			const isYawGood = Math.abs(yaw) <= MAX_YAW_ANGLE;
			const isPitchGood = Math.abs(pitch) <= MAX_PITCH_ANGLE;
			const isAngleGood = isYawGood && isPitchGood;

			// Determine guidance message - prioritize most important issue
			let message = "";
			if (!isSized) {
				if (sizeRatio < MIN_FACE_SIZE_RATIO) {
					message = "Move closer";
				} else {
					message = "Move back";
				}
			} else if (!isAngleGood) {
				// Head rotation guidance - video is mirrored, so directions are intuitive
				if (!isYawGood) {
					// Yaw: negative = looking left in real life (appears right in mirrored video)
					if (yaw < -MAX_YAW_ANGLE) {
						message = "Turn right";
					} else if (yaw > MAX_YAW_ANGLE) {
						message = "Turn left";
					}
				} else if (!isPitchGood) {
					// Pitch: positive = looking up, negative = looking down
					if (pitch < -MAX_PITCH_ANGLE) {
						message = "Look up";
					} else if (pitch > MAX_PITCH_ANGLE) {
						message = "Look down";
					}
				}
			} else if (!isCentered || !isInCircle) {
				if (offsetX > offsetY) {
					message = faceCenterX < frameCenterX ? "Move right" : "Move left";
				} else {
					message = faceCenterY < frameCenterY ? "Move down" : "Move up";
				}
			} else {
				message = "Perfect! Hold still...";
			}

			return {
				isValid:
					isCentered &&
					isSized &&
					isInCircle &&
					isAngleGood &&
					isEnrollmentQuality(detection),
				isCentered,
				isSized,
				isInCircle,
				isAngleGood,
				message,
			};
		},
		[],
	);

	// Reset the enrollment flow
	const reset = useCallback(() => {
		setError(null);
		setUser(null);
		setFaceDetection(null);
		setPositioningGuide("Position your face in the circle");
		setIsPositionGood(false);
		setEmotionMessage(null);
		capturedDescriptorRef.current = null;
		pendingCardRef.current = null;

		if (scanIntervalRef.current) {
			clearInterval(scanIntervalRef.current);
			scanIntervalRef.current = null;
		}
		if (countdownIntervalRef.current) {
			clearInterval(countdownIntervalRef.current);
			countdownIntervalRef.current = null;
		}
	}, []);

	// Start camera and prepare for enrollment
	const startCameraAndSetup = useCallback(async () => {
		setStep("camera_setup");
		setSetupProgress("camera");

		console.log("[FaceIdEnrollment] Starting camera...");
		await camera.startCamera();

		// Wait for camera video to actually have dimensions
		let cameraAttempts = 0;
		while (cameraAttempts < 50) {
			const video = camera.videoRef.current;
			if (video && video.readyState >= 2 && video.videoWidth > 0) {
				console.log("[FaceIdEnrollment] Camera video ready:", {
					readyState: video.readyState,
					width: video.videoWidth,
					height: video.videoHeight,
				});
				break;
			}
			await new Promise((resolve) => setTimeout(resolve, 100));
			cameraAttempts++;
		}

		// Wait for models to be loaded
		if (!camera.modelsLoaded) {
			setSetupProgress("models");
			console.log("[FaceIdEnrollment] Waiting for models to load...");
			let modelAttempts = 0;
			while (!camera.modelsLoaded && modelAttempts < 100) {
				await new Promise((resolve) => setTimeout(resolve, 100));
				modelAttempts++;
			}
		}

		setSetupProgress("ready");
		console.log(
			"[FaceIdEnrollment] Ready for scanning, models loaded:",
			camera.modelsLoaded,
		);
		setStep("scanning");
	}, [camera]);

	// Handle card scan during enrollment
	const handleCardScan = useCallback(
		async (scannedCardNumber: string) => {
			console.log(
				"[FaceIdEnrollment] Card scanned:",
				`${scannedCardNumber.slice(0, 4)}...`,
			);
			if (stepRef.current !== "card_prompt") {
				console.log(
					"[FaceIdEnrollment] Ignoring card scan, current step:",
					stepRef.current,
				);
				return;
			}

			pendingCardRef.current = scannedCardNumber;
			setStep("card_verifying");

			try {
				const result = await trpc.faceId.verifyCardForEnrollment.mutate({
					cardNumber: scannedCardNumber,
				});

				console.log(
					"[FaceIdEnrollment] Card verified, user:",
					result.user.name,
					"hasExisting:",
					result.hasExistingEnrollment,
				);
				setUser(result.user);

				if (result.hasExistingEnrollment) {
					setStep("existing_enrollment");
				} else {
					await startCameraAndSetup();
				}
			} catch (err) {
				console.error("[FaceIdEnrollment] Card verification error:", err);
				const message =
					err instanceof Error ? err.message : "Verification failed";
				setError(message);
				setStep("error");
			}
		},
		[startCameraAndSetup],
	);

	// Handle re-enrollment (delete old and create new)
	const handleReenroll = useCallback(async () => {
		const cardNumber = pendingCardRef.current;
		if (!cardNumber || !user) {
			setError("Card information lost. Please try again.");
			setStep("error");
			return;
		}

		setStep("card_verifying");

		try {
			console.log(
				"[FaceIdEnrollment] Deleting existing enrollment for user:",
				user.id,
			);
			await trpc.faceId.kioskDeleteEnrollment.mutate({ userId: user.id });

			console.log(
				"[FaceIdEnrollment] Existing enrollment deleted, proceeding to setup",
			);
			await startCameraAndSetup();
		} catch (err) {
			console.error("[FaceIdEnrollment] Re-enrollment failed:", err);
			const message =
				err instanceof Error ? err.message : "Re-enrollment failed";
			setError(message);
			setStep("error");
		}
	}, [startCameraAndSetup, user]);

	// Store the card scan handler in a ref
	cardScanHandlerRef.current = (cardNumber: string) => {
		void handleCardScan(cardNumber);
	};

	// Register card handler once on mount
	useEffect(() => {
		console.log(
			"[FaceIdEnrollment] Component mounted, registering card handler",
		);
		if (onRegisterCardHandler) {
			onRegisterCardHandler((cardNumber) => {
				cardScanHandlerRef.current?.(cardNumber);
			});
		}
	}, [onRegisterCardHandler]);

	// Sync the shared camera stream to local video element for display
	useEffect(() => {
		if (step !== "scanning") return;

		const syncVideo = () => {
			const localVideo = localVideoRef.current;
			const sharedVideo = camera.videoRef.current;

			if (localVideo && sharedVideo?.srcObject) {
				localVideo.srcObject = sharedVideo.srcObject;
				localVideo.play().catch((err) => {
					console.error("[FaceIdEnrollment] Failed to play local video:", err);
				});
				return true;
			}
			return false;
		};

		if (syncVideo()) return;

		const pollInterval = setInterval(() => {
			if (syncVideo()) {
				clearInterval(pollInterval);
			}
		}, 100);

		return () => clearInterval(pollInterval);
	}, [step, camera.videoRef]);

	// Face scanning phase - checks position, expressions, and manages countdown
	useEffect(() => {
		if (step !== "scanning" || !camera.modelsLoaded) {
			return;
		}

		console.log("[FaceIdEnrollment] Starting scanning phase...");

		const scan = async () => {
			const localVideo = localVideoRef.current;
			const sharedVideo = camera.videoRef.current;

			const localVideoReady =
				localVideo && localVideo.readyState >= 2 && localVideo.videoWidth > 0;
			const sharedVideoReady =
				sharedVideo &&
				sharedVideo.readyState >= 2 &&
				sharedVideo.videoWidth > 0;

			const videoElement = localVideoReady
				? localVideo
				: sharedVideoReady
					? sharedVideo
					: null;

			if (!videoElement) return;

			try {
				const detection = await detectFaceWithExpression(videoElement);
				setFaceDetection(detection);

				const frameWidth = videoElement.videoWidth;
				const frameHeight = videoElement.videoHeight;
				const position = checkFacePosition(detection, frameWidth, frameHeight);

				// Check expression - only allow neutral for enrollment
				// Higher thresholds = less sensitive detection
				let expressionOk = true;
				let emotionMsg: string | null = null;

				if (detection.expression) {
					const expr = detection.expression.type;
					const conf = detection.expression.confidence;

					// Different thresholds for different emotions
					// Sad requires very high confidence (often falsely detected)
					if (expr === "happy" && conf > 0.85) {
						emotionMsg = "Stop smiling!";
						expressionOk = false;
					} else if (expr === "sad" && conf > 0.95) {
						emotionMsg = "Cheer up a bit!";
						expressionOk = false;
					} else if (expr === "angry" && conf > 0.85) {
						emotionMsg = "Relax your face!";
						expressionOk = false;
					} else if (expr === "surprised" && conf > 0.85) {
						emotionMsg = "Relax your face!";
						expressionOk = false;
					} else if (expr === "fearful" && conf > 0.9) {
						emotionMsg = "Relax, you're safe!";
						expressionOk = false;
					} else if (expr === "disgusted" && conf > 0.9) {
						emotionMsg = "Keep a neutral face!";
						expressionOk = false;
					}
				}

				setEmotionMessage(emotionMsg);

				// Position and expression must both be good
				const fullyGood =
					position.isValid && detection.descriptor !== null && expressionOk;
				setIsPositionGood(fullyGood);

				// Store the descriptor if everything is good
				if (fullyGood && detection.descriptor) {
					capturedDescriptorRef.current = detection.descriptor;
				}

				// Update positioning guide based on state
				if (emotionMsg) {
					setPositioningGuide(emotionMsg);
				} else {
					setPositioningGuide(position.message);
				}
			} catch (err) {
				console.error("[FaceIdEnrollment] Face detection error:", err);
			}
		};

		scanIntervalRef.current = setInterval(() => {
			void scan();
		}, SCAN_INTERVAL_MS);

		// Hold-still timer - wait for user to hold position
		// Tracks how many consecutive ticks the position has been good
		// Allow some tolerance by counting "mostly good" frames
		let goodPositionTicks = 0;
		let badTicksInWindow = 0;
		const REQUIRED_GOOD_TICKS = 15; // 1.5 seconds at 100ms intervals (reduced from 2.5s)
		const MAX_BAD_TICKS_ALLOWED = 3; // Allow up to 3 "bad" ticks during the hold window

		const holdStillTick = () => {
			// Read current state via functional update pattern
			setIsPositionGood((isGood) => {
				if (isGood) {
					goodPositionTicks++;

					if (goodPositionTicks === 1) {
						console.log("[FaceIdEnrollment] Position good, hold still...");
						setPositioningGuide("Perfect! Hold still...");
					}

					if (goodPositionTicks >= REQUIRED_GOOD_TICKS) {
						// Held position long enough - capture!
						console.log("[FaceIdEnrollment] Hold complete, capturing!");
						setPositioningGuide("Capturing...");

						if (scanIntervalRef.current) {
							clearInterval(scanIntervalRef.current);
							scanIntervalRef.current = null;
						}
						if (countdownIntervalRef.current) {
							clearInterval(countdownIntervalRef.current);
							countdownIntervalRef.current = null;
						}
						setStep("processing");
					}
				} else {
					// Allow some tolerance for brief position losses
					badTicksInWindow++;
					if (
						badTicksInWindow > MAX_BAD_TICKS_ALLOWED ||
						goodPositionTicks === 0
					) {
						if (goodPositionTicks > 0) {
							console.log("[FaceIdEnrollment] Position lost, resetting timer");
						}
						goodPositionTicks = 0;
						badTicksInWindow = 0;
					}
				}
				return isGood; // Return unchanged
			});
		};

		// Run hold-still check every 100ms
		countdownIntervalRef.current = setInterval(holdStillTick, 100);

		return () => {
			if (scanIntervalRef.current) {
				clearInterval(scanIntervalRef.current);
				scanIntervalRef.current = null;
			}
			if (countdownIntervalRef.current) {
				clearInterval(countdownIntervalRef.current);
				countdownIntervalRef.current = null;
			}
		};
	}, [step, camera.modelsLoaded, checkFacePosition]);

	// Ref to prevent double-processing of enrollment
	const isProcessingRef = useRef(false);

	// Process enrollment with the captured descriptor
	useEffect(() => {
		if (step !== "processing" || !user || !capturedDescriptorRef.current)
			return;

		// Guard against double execution
		if (isProcessingRef.current) return;
		isProcessingRef.current = true;

		const processEnrollment = async () => {
			try {
				console.log(
					"[FaceIdEnrollment] Processing enrollment for user:",
					user.id,
				);

				const descriptor = capturedDescriptorRef.current;
				if (!descriptor) {
					console.error("[FaceIdEnrollment] No descriptor captured");
					return;
				}

				// Capture a snapshot for the enrollment event (non-blocking)
				const imageData = camera.captureDataUrl(0.8);
				if (imageData) {
					console.log("[FaceIdEnrollment] Uploading enrollment snapshot...");
					// Don't await - let it upload in background
					trpc.security.uploadSnapshot
						.mutate({
							imageData,
							eventType: "FACE_ID_ENROLLMENT",
							userId: user.id,
							faceDetected: true,
							faceConfidence: 1.0, // We know face was detected during enrollment
						})
						.catch((err) => {
							console.warn(
								"[FaceIdEnrollment] Snapshot upload failed (non-critical):",
								err,
							);
						});
				}

				console.log("[FaceIdEnrollment] Saving face descriptor...");
				const verificationCardNumber = pendingCardRef.current;
				if (!verificationCardNumber) {
					throw new Error(
						"Card verification information lost. Please try again.",
					);
				}

				await trpc.faceId.enroll.mutate({
					userId: user.id,
					faceDescriptor: serializeDescriptor(descriptor),
					verificationCardNumber,
				});

				console.log("[FaceIdEnrollment] Enrollment successful!");

				setStep("success");

				setTimeout(() => {
					onComplete?.();
				}, 2000);
			} catch (err) {
				console.error("[FaceIdEnrollment] Enrollment failed:", err);
				const message =
					err instanceof Error ? err.message : "Enrollment failed";
				setError(message);
				setStep("error");
			}
		};

		void processEnrollment();
	}, [step, user, camera, onComplete]);

	const handleCancel = useCallback(() => {
		isProcessingRef.current = false;
		reset();
		onCancel?.();
	}, [reset, onCancel]);

	const handleRetry = useCallback(() => {
		isProcessingRef.current = false;
		reset();
		setStep("card_prompt");
	}, [reset]);

	const getVideoDimensions = () => {
		const localVideo = localVideoRef.current;
		if (localVideo && localVideo.videoWidth > 0) {
			return { width: localVideo.videoWidth, height: localVideo.videoHeight };
		}
		return camera.cameraDimensions;
	};

	// Render face detection overlay with positioning guides
	const renderFaceOverlay = () => {
		const dimensions = getVideoDimensions();
		if (!dimensions) return null;

		const { width, height } = dimensions;
		const centerX = width / 2;
		const centerY = height / 2;
		const circleRadius = Math.min(width, height) * CIRCLE_RADIUS_RATIO;

		const position = faceDetection
			? checkFacePosition(faceDetection, width, height)
			: null;
		const isGoodPositionLocal = position?.isValid ?? false;

		let circleColor = "#ffffff";
		if (isGoodPositionLocal) {
			circleColor = "#22c55e"; // Green when position is good
		} else if (faceDetection?.detected) {
			circleColor = "#f59e0b"; // Amber when face detected but not in position
		}

		return (
			<>
				<svg
					className="absolute inset-0 pointer-events-none"
					viewBox={`0 0 ${width} ${height}`}
					preserveAspectRatio="xMidYMid meet"
					aria-hidden="true"
				>
					{/* Darkened overlay with circle cutout */}
					<defs>
						<mask id="circleMask">
							<rect width="100%" height="100%" fill="white" />
							<circle cx={centerX} cy={centerY} r={circleRadius} fill="black" />
						</mask>
					</defs>
					<rect
						width="100%"
						height="100%"
						fill="rgba(0,0,0,0.6)"
						mask="url(#circleMask)"
					/>

					{/* Background circle (guide) */}
					<circle
						cx={centerX}
						cy={centerY}
						r={circleRadius}
						fill="none"
						stroke="rgba(255,255,255,0.3)"
						strokeWidth={6}
					/>

					{/* Active circle (shows current state) */}
					<circle
						cx={centerX}
						cy={centerY}
						r={circleRadius}
						fill="none"
						stroke={circleColor}
						strokeWidth={6}
						strokeLinecap="round"
						className="transition-all duration-200"
					/>

					{/* Face landmarks - render all 68 points, mirrored to match video */}
					{faceDetection?.detected && faceDetection.landmarks && (
						<g>
							{faceDetection.landmarks.map((point, index) => (
								<circle
									key={index}
									cx={width - point.x}
									cy={point.y}
									r={2}
									fill={isGoodPositionLocal ? "#22c55e" : "#f59e0b"}
								/>
							))}
						</g>
					)}
				</svg>

				{/* Emotion warning message */}
				{emotionMessage && (
					<div className="absolute top-20 left-0 right-0 text-center">
						<motion.span
							key={emotionMessage}
							initial={{ opacity: 0, y: -10 }}
							animate={{ opacity: 1, y: 0 }}
							className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium bg-red-500/90 text-white"
						>
							<Meh className="w-4 h-4" />
							{emotionMessage}
						</motion.span>
					</div>
				)}

				{/* Positioning message */}
				<div className="absolute bottom-20 left-0 right-0 text-center">
					<motion.span
						key={positioningGuide}
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						className={`px-4 py-2 rounded-full text-sm font-medium ${
							isGoodPositionLocal
								? "bg-green-500/90 text-white"
								: "bg-amber-500/90 text-white"
						}`}
					>
						{positioningGuide}
					</motion.span>
				</div>
			</>
		);
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
			<AnimatePresence mode="wait">
				{step === "card_prompt" && (
					<motion.div
						key="card_prompt"
						initial={{ opacity: 0, scale: 0.9 }}
						animate={{ opacity: 1, scale: 1 }}
						exit={{ opacity: 0, scale: 0.9 }}
						className="bg-card rounded-2xl p-8 max-w-md text-center"
					>
						<h2 className="text-2xl font-bold mb-4">Tap Your Card</h2>
						<p className="text-muted-foreground mb-6">
							Please tap your BuzzCard to verify your identity before setting up
							Face ID.
						</p>
						<div className="flex justify-center mb-6">
							<CreditCard className="w-16 h-16 text-muted-foreground animate-pulse" />
						</div>
						<Button variant="outline" onClick={handleCancel}>
							Cancel
						</Button>
					</motion.div>
				)}

				{step === "card_verifying" && (
					<motion.div
						key="card_verifying"
						initial={{ opacity: 0, scale: 0.9 }}
						animate={{ opacity: 1, scale: 1 }}
						exit={{ opacity: 0, scale: 0.9 }}
						className="bg-card rounded-2xl p-8 max-w-md text-center"
					>
						<h2 className="text-2xl font-bold mb-4">Verifying...</h2>
						<div className="flex justify-center">
							<Loader2 className="w-10 h-10 text-muted-foreground animate-spin" />
						</div>
					</motion.div>
				)}

				{step === "existing_enrollment" && (
					<motion.div
						key="existing_enrollment"
						initial={{ opacity: 0, scale: 0.9 }}
						animate={{ opacity: 1, scale: 1 }}
						exit={{ opacity: 0, scale: 0.9 }}
						className="bg-card rounded-2xl p-8 max-w-md text-center"
					>
						<div className="flex justify-center mb-4">
							<RefreshCw className="w-16 h-16 text-amber-500" />
						</div>
						<h2 className="text-2xl font-bold mb-4">Face ID Already Set Up</h2>
						<p className="text-muted-foreground mb-6">
							You already have Face ID enrolled. Would you like to delete your
							existing Face ID and set up a new one?
						</p>
						<div className="flex gap-4 justify-center">
							<Button variant="outline" onClick={handleCancel}>
								Keep Existing
							</Button>
							<Button onClick={handleReenroll}>Re-enroll</Button>
						</div>
					</motion.div>
				)}

				{step === "camera_setup" && (
					<motion.div
						key="camera_setup"
						initial={{ opacity: 0, scale: 0.9 }}
						animate={{ opacity: 1, scale: 1 }}
						exit={{ opacity: 0, scale: 0.9 }}
						className="bg-card rounded-2xl p-8 max-w-md text-center"
					>
						<h2 className="text-2xl font-bold mb-4">
							{setupProgress === "camera"
								? "Starting camera..."
								: setupProgress === "models"
									? "Loading face recognition..."
									: "Almost ready..."}
						</h2>
						<p className="text-muted-foreground mb-6">
							Hello, {user?.name}! Please wait while we prepare for enrollment.
						</p>

						{/* Progress steps */}
						<div className="space-y-3 text-left max-w-xs mx-auto mb-6">
							<div className="flex items-center gap-3">
								{setupProgress === "camera" ? (
									<Loader2 className="w-5 h-5 text-primary animate-spin" />
								) : (
									<CheckCircle2 className="w-5 h-5 text-green-500" />
								)}
								<span
									className={
										setupProgress === "camera"
											? "text-foreground font-medium"
											: "text-muted-foreground"
									}
								>
									Starting camera
								</span>
							</div>
							<div className="flex items-center gap-3">
								{setupProgress === "camera" ? (
									<div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30" />
								) : setupProgress === "models" ? (
									<Loader2 className="w-5 h-5 text-primary animate-spin" />
								) : (
									<CheckCircle2 className="w-5 h-5 text-green-500" />
								)}
								<span
									className={
										setupProgress === "models"
											? "text-foreground font-medium"
											: setupProgress === "camera"
												? "text-muted-foreground/50"
												: "text-muted-foreground"
									}
								>
									Loading face recognition
								</span>
							</div>
						</div>

						<p className="text-sm text-muted-foreground/70">
							{setupProgress === "models"
								? "This may take a few seconds on first use..."
								: "Please wait..."}
						</p>
					</motion.div>
				)}

				{step === "scanning" && (
					<motion.div
						key="scanning"
						initial={{ opacity: 0, scale: 0.9 }}
						animate={{ opacity: 1, scale: 1 }}
						exit={{ opacity: 0, scale: 0.9 }}
						className="bg-card rounded-2xl p-4 max-w-2xl"
					>
						<div className="text-center mb-4">
							<h2 className="text-xl font-bold">Set Up Face ID</h2>
							<p className="text-muted-foreground text-sm">
								Position your face in the circle and hold still for 3 seconds
							</p>
						</div>

						<div className="relative aspect-video bg-black rounded-lg overflow-hidden">
							<video
								ref={localVideoRef}
								autoPlay
								playsInline
								muted
								className="w-full h-full object-cover scale-x-[-1]"
							/>
							{renderFaceOverlay()}
						</div>

						<div className="mt-4 flex justify-center">
							<Button variant="outline" onClick={handleCancel}>
								Cancel
							</Button>
						</div>
					</motion.div>
				)}

				{step === "processing" && (
					<motion.div
						key="processing"
						initial={{ opacity: 0, scale: 0.9 }}
						animate={{ opacity: 1, scale: 1 }}
						exit={{ opacity: 0, scale: 0.9 }}
						className="bg-card rounded-2xl p-8 max-w-md text-center"
					>
						<h2 className="text-2xl font-bold mb-4">Processing Face ID...</h2>
						<p className="text-muted-foreground mb-4">
							Creating your unique face signature...
						</p>
						<div className="flex justify-center">
							<Save className="w-10 h-10 text-muted-foreground animate-pulse" />
						</div>
					</motion.div>
				)}

				{step === "success" && (
					<motion.div
						key="success"
						initial={{ opacity: 0, scale: 0.9 }}
						animate={{ opacity: 1, scale: 1 }}
						exit={{ opacity: 0, scale: 0.9 }}
						className="bg-card rounded-2xl p-8 max-w-md text-center"
					>
						<div className="flex justify-center mb-4">
							<CheckCircle2 className="w-16 h-16 text-green-500" />
						</div>
						<h2 className="text-2xl font-bold mb-4">Face ID Set Up!</h2>
						<p className="text-muted-foreground">
							You can now tap in and out using Face ID.
						</p>
					</motion.div>
				)}

				{step === "error" && (
					<motion.div
						key="error"
						initial={{ opacity: 0, scale: 0.9 }}
						animate={{ opacity: 1, scale: 1 }}
						exit={{ opacity: 0, scale: 0.9 }}
						className="bg-card rounded-2xl p-8 max-w-md text-center"
					>
						<div className="flex justify-center mb-4">
							<XCircle className="w-16 h-16 text-red-500" />
						</div>
						<h2 className="text-2xl font-bold mb-4">Setup Failed</h2>
						<p className="text-muted-foreground mb-6">{error}</p>
						<div className="flex gap-4 justify-center">
							<Button variant="outline" onClick={handleCancel}>
								Cancel
							</Button>
							<Button onClick={handleRetry}>Try Again</Button>
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}

export { FaceIdEnrollment as default };
