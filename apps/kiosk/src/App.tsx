import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { CameraProvider, useCameraContext } from "@/components/camera-provider";
import { ErrorBoundary } from "@/components/error-boundary";
import { FlowOverlays } from "@/components/flow-overlays";
import { KioskContainer } from "@/components/kiosk-container";
import { KioskHeader } from "@/components/kiosk-header";
import { OneTimeLoginQR } from "@/components/one-time-login-qr";
import { ReadyView } from "@/components/ready-view";
import { SetupView } from "@/components/setup-view";
import { useCardReader } from "@/hooks/use-card-reader";
import { useTapWorkflow } from "@/hooks/use-tap-workflow";
import { useBranding } from "@/hooks/useBranding";
import { useConfig } from "@/hooks/useConfig";
import type { KioskStatus } from "@/types";

function AppContent() {
	// Load and apply branding
	useBranding();
	const [isFullscreen, setIsFullscreen] = useState(false);
	const tapWorkflow = useTapWorkflow();
	const { data: config } = useConfig();

	// Camera context for snapshots and face presence detection
	const cameraContext = useCameraContext();

	const { data: deviceStatusData, isLoading: deviceStatusLoading } = useQuery({
		queryKey: ["deviceStatus"],
		queryFn: async () => {
			return await trpc.devices.checkStatus.query({});
		},
		retry: 1,
		refetchOnWindowFocus: false,
	});

	const kioskStatus: KioskStatus = {
		isKiosk: !!(
			deviceStatusData?.status && deviceStatusData.device?.hasKioskAccess
		),
		ip: deviceStatusData?.status
			? deviceStatusData.device?.ipAddress
			: deviceStatusData?.ip,
		checking: deviceStatusLoading,
	};

	// Enhanced tap handler that captures snapshots (non-blocking)
	const handleTapWithSnapshot = useCallback(
		async (cardNumber: string) => {
			console.log("[App] handleTapWithSnapshot called");

			// Cancel any pending presence snapshots since user is tapping
			cameraContext.notifyTapEvent();

			// Start camera if not already running (don't wait for it to be fully ready)
			if (!cameraContext.isCameraReady) {
				console.log("[App] Camera not ready, starting in background...");
				// Start camera but don't block on it
				void cameraContext.startCamera();
			}

			// Look up the user by card number first (quick query) for the snapshot
			// This happens in parallel with the tap - don't block the main flow
			console.log("[App] Looking up user for snapshot...");
			const lookupAndCapture = async () => {
				try {
					const result = await trpc.security.lookupUserByCard.query({
						cardNumber,
					});
					console.log("[App] User lookup result:", result);
					const userId = result.found ? result.userId : undefined;
					await cameraContext.captureSecuritySnapshot("TAP", userId);
				} catch (err) {
					console.warn("[App] User lookup or snapshot failed:", err);
					// Fallback: capture without userId
					await cameraContext.captureSecuritySnapshot("TAP").catch((err2) => {
						console.warn("[App] Fallback snapshot also failed:", err2);
					});
				}
			};
			void lookupAndCapture();

			// Process the tap immediately without waiting for snapshot
			console.log("[App] Processing tap workflow");
			await tapWorkflow.handleTap(cardNumber);
		},
		[cameraContext, tapWorkflow],
	);

	// Card handler for tap events
	const handleCardScan = useCallback(
		(cardNumber: string) => {
			console.log("[App] Card scan routed to regular tap workflow");
			void handleTapWithSnapshot(cardNumber);
		},
		[handleTapWithSnapshot],
	);

	const { connectionStatus, connect } = useCardReader({
		onScan: handleCardScan,
		onFatalError: tapWorkflow.showError,
		onInvalidScan: () =>
			tapWorkflow.showError("Unable to read card. Please tap again."),
	});

	// Start camera when connected
	useEffect(() => {
		if (connectionStatus === "connected" && kioskStatus.isKiosk) {
			console.log("[App] Connection ready, starting camera");
			void cameraContext.startCamera();
		}
	}, [connectionStatus, kioskStatus.isKiosk, cameraContext.startCamera]);

	// Start face presence detection when camera is ready and models are loaded
	useEffect(() => {
		const shouldScan =
			cameraContext.isCameraReady &&
			cameraContext.modelsLoaded &&
			!cameraContext.isFacePresenceScanning;

		console.log("[App] Face presence scan check:", {
			cameraReady: cameraContext.isCameraReady,
			modelsLoaded: cameraContext.modelsLoaded,
			isFacePresenceScanning: cameraContext.isFacePresenceScanning,
			shouldScan,
		});

		if (shouldScan) {
			console.log("[App] Starting face presence scanning");
			cameraContext.startFacePresenceScanning();
		}
	}, [
		cameraContext.isCameraReady,
		cameraContext.modelsLoaded,
		cameraContext.isFacePresenceScanning,
		cameraContext.startFacePresenceScanning,
	]);

	const toggleFullscreen = async () => {
		if (!document.fullscreenElement) {
			await document.documentElement.requestFullscreen();
			setIsFullscreen(true);
		} else {
			await document.exitFullscreen();
			setIsFullscreen(false);
		}
	};

	useEffect(() => {
		const handleFullscreenChange = () => {
			setIsFullscreen(!!document.fullscreenElement);
		};

		const fsEvents = [
			"fullscreenchange",
			"webkitfullscreenchange",
			"mozfullscreenchange",
			"MSFullscreenChange",
		] as const;

		for (const eventName of fsEvents) {
			document.addEventListener(eventName, handleFullscreenChange);
		}

		return () => {
			for (const eventName of fsEvents) {
				document.removeEventListener(eventName, handleFullscreenChange);
			}
		};
	}, []);

	// Determine the client base URL for one-time login
	// Use runtime config clientBaseUrl, otherwise fall back to current page's origin
	const clientBaseUrl = config?.clientBaseUrl || window.location.origin;

	const isPreConnection =
		!kioskStatus.isKiosk ||
		connectionStatus === "disconnected" ||
		connectionStatus === "connecting" ||
		connectionStatus === "error";

	return (
		<ErrorBoundary>
			<KioskContainer>
				<div className="h-full min-w-full overflow-hidden dark flex flex-col">
					{isPreConnection && (
						<KioskHeader
							connectionStatus={connectionStatus}
							kioskStatus={kioskStatus}
							isFullscreen={isFullscreen}
							onToggleFullscreen={toggleFullscreen}
						/>
					)}

					<main className="min-w-full flex-1 overflow-hidden relative">
						<FlowOverlays
							errorDialog={tapWorkflow.errorDialog}
							sessionTypeSelection={tapWorkflow.sessionTypeSelection}
							tapOutActionSelection={tapWorkflow.tapOutActionSelection}
							earlyLeaveConfirmation={tapWorkflow.earlyLeaveConfirmation}
							shiftEarlyLeaveConfirmation={
								tapWorkflow.shiftEarlyLeaveConfirmation
							}
							pendingAgreement={tapWorkflow.pendingAgreement}
							tapNotification={tapWorkflow.tapNotification}
							suspension={tapWorkflow.suspension}
							onSessionTypeSelect={tapWorkflow.handleSessionTypeSelect}
							onSessionTypeCancel={tapWorkflow.handleSessionTypeCancel}
							onTapOutActionSelect={tapWorkflow.handleTapOutActionSelect}
							onTapOutActionCancel={tapWorkflow.handleTapOutActionCancel}
							onEarlyLeaveConfirm={tapWorkflow.handleEarlyLeaveConfirm}
							onEarlyLeaveCancel={tapWorkflow.handleEarlyLeaveCancel}
							onShiftEarlyLeaveConfirm={
								tapWorkflow.handleShiftEarlyLeaveConfirm
							}
							onShiftEarlyLeaveCancel={tapWorkflow.handleShiftEarlyLeaveCancel}
							onAgreementComplete={tapWorkflow.handleAgreementComplete}
							onAgreementCancel={tapWorkflow.handleAgreementCancel}
							onAgreementError={tapWorkflow.handleAgreementError}
							onAgreementProgress={tapWorkflow.resetAgreementTimeout}
						/>

						<div className="min-w-full h-full flex items-center justify-center">
							{connectionStatus !== "connected" ? (
								<SetupView
									connectionStatus={connectionStatus}
									kioskStatus={kioskStatus}
									errorMessage={tapWorkflow.errorDialog.message}
									onConnect={() => {
										void connect();
									}}
								/>
							) : (
								<ReadyView
									isFullscreen={isFullscreen}
									isProcessing={tapWorkflow.isProcessing}
									onToggleFullscreen={toggleFullscreen}
								/>
							)}
						</div>
					</main>

					{connectionStatus === "connected" && (
						<OneTimeLoginQR
							code={tapWorkflow.oneTimeLogin?.code ?? null}
							clientUrl={clientBaseUrl}
							expiresAt={tapWorkflow.oneTimeLogin?.expiresAt ?? null}
							onShow={tapWorkflow.handleLoginWithoutCard}
							onHide={tapWorkflow.handleLoginWithoutCardCancel}
						/>
					)}
				</div>
			</KioskContainer>
		</ErrorBoundary>
	);
}

function App() {
	return (
		<CameraProvider enabled>
			<AppContent />
		</CameraProvider>
	);
}

export default App;
