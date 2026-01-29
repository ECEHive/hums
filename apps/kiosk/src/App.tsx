import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
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

function App() {
	// Load and apply branding
	useBranding();
	const [isFullscreen, setIsFullscreen] = useState(false);
	const tapWorkflow = useTapWorkflow();
	const { data: config } = useConfig();

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

	const { connectionStatus, connect } = useCardReader({
		onScan: (cardNumber) => tapWorkflow.handleTap(cardNumber),
		onFatalError: tapWorkflow.showError,
		onInvalidScan: () =>
			tapWorkflow.showError("Unable to read card. Please tap again."),
	});

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

export default App;
