import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { FlowOverlays } from "@/components/flow-overlays";
import { KioskContainer } from "@/components/kiosk-container";
import { KioskHeader } from "@/components/kiosk-header";
import { ReadyView } from "@/components/ready-view";
import { SetupView } from "@/components/setup-view";
import { useCardReader } from "@/hooks/use-card-reader";
import { useTapWorkflow } from "@/hooks/use-tap-workflow";
import type { KioskStatus } from "@/types";

function App() {
	const [isFullscreen, setIsFullscreen] = useState(false);
	const tapWorkflow = useTapWorkflow();

	const { data: kioskStatusData, isLoading: kioskStatusLoading } = useQuery({
		queryKey: ["kioskStatus"],
		queryFn: async () => {
			return await trpc.kiosks.checkStatus.query({});
		},
		retry: 1,
		refetchOnWindowFocus: false,
	});

	const kioskStatus: KioskStatus = {
		isKiosk: kioskStatusData?.status ?? false,
		ip: kioskStatusData?.status
			? kioskStatusData.kiosk?.ipAddress
			: kioskStatusData?.ip,
		checking: kioskStatusLoading,
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

	const logoUrl = new URL("./assets/logo_dark.svg", import.meta.url).href;

	const isPreConnection =
		!kioskStatus.isKiosk ||
		connectionStatus === "disconnected" ||
		connectionStatus === "connecting" ||
		connectionStatus === "error";

	return (
		<KioskContainer>
			<div className="h-full min-w-full overflow-hidden dark flex flex-col">
				{isPreConnection && (
					<KioskHeader
						logoUrl={logoUrl}
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
						pendingAgreement={tapWorkflow.pendingAgreement}
						tapNotification={tapWorkflow.tapNotification}
						onSessionTypeSelect={tapWorkflow.handleSessionTypeSelect}
						onSessionTypeCancel={tapWorkflow.handleSessionTypeCancel}
						onTapOutActionSelect={tapWorkflow.handleTapOutActionSelect}
						onTapOutActionCancel={tapWorkflow.handleTapOutActionCancel}
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
								logoUrl={logoUrl}
								isFullscreen={isFullscreen}
								isProcessing={tapWorkflow.isProcessing}
								onToggleFullscreen={toggleFullscreen}
							/>
						)}
					</div>
				</main>
			</div>
		</KioskContainer>
	);
}

export default App;
