import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ApprovalDialog } from "@/components/approval-dialog";
import { ErrorBoundary } from "@/components/error-boundary";
import { FlowOverlays } from "@/components/flow-overlays";
import { InventoryTransactionView } from "@/components/inventory-transaction-view";
import { KioskContainer } from "@/components/kiosk-container";
import { KioskHeader } from "@/components/kiosk-header";
import { ReadyView } from "@/components/ready-view";
import { SetupView } from "@/components/setup-view";
import { useCardReader } from "@/hooks/use-card-reader";
import { useInventoryWorkflow } from "@/hooks/use-inventory-workflow";
import { useBranding } from "@/hooks/useBranding";
import type { KioskStatus } from "@/types";

function App() {
	// Load and apply branding
	useBranding();

	const [isFullscreen, setIsFullscreen] = useState(false);
	const inventoryWorkflow = useInventoryWorkflow();

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
			deviceStatusData?.status && deviceStatusData.device?.hasInventoryAccess
		),
		ip: deviceStatusData?.status
			? deviceStatusData.device?.ipAddress
			: deviceStatusData?.ip,
		checking: deviceStatusLoading,
	};

	const { connectionStatus, connect } = useCardReader({
		onScan: (cardNumber) => inventoryWorkflow.handleScan(cardNumber),
		onFatalError: inventoryWorkflow.showError,
		onInvalidScan: () =>
			inventoryWorkflow.showError("Unable to read card. Please tap again."),
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
							errorDialog={inventoryWorkflow.errorDialog}
							scanNotification={inventoryWorkflow.scanNotification}
							successNotification={inventoryWorkflow.successNotification}
							suspension={inventoryWorkflow.suspension}
						/>

						{inventoryWorkflow.approvalDialog && (
							<ApprovalDialog
								restrictedItems={
									inventoryWorkflow.approvalDialog.restrictedItems
								}
								transactionType={
									inventoryWorkflow.approvalDialog.pendingTransaction?.type ??
									"checkout"
								}
								isProcessing={inventoryWorkflow.approvalDialog.isProcessing}
								error={inventoryWorkflow.approvalDialog.error}
								onCancel={inventoryWorkflow.handleApprovalCancel}
							/>
						)}

						{inventoryWorkflow.transactionView &&
							!inventoryWorkflow.approvalDialog && (
								<InventoryTransactionView
									userName={inventoryWorkflow.transactionView.userName}
									canReturn={inventoryWorkflow.transactionView.canReturn}
									onCheckout={inventoryWorkflow.handleCheckout}
									onReturn={inventoryWorkflow.handleReturn}
									onCancel={inventoryWorkflow.handleTransactionCancel}
								/>
							)}

						<div className="min-w-full h-full flex items-center justify-center">
							{connectionStatus !== "connected" ? (
								<SetupView
									connectionStatus={connectionStatus}
									kioskStatus={kioskStatus}
									errorMessage={inventoryWorkflow.errorDialog.message}
									onConnect={() => {
										void connect();
									}}
								/>
							) : (
								<ReadyView
									isFullscreen={isFullscreen}
									isProcessing={inventoryWorkflow.isProcessing}
									onToggleFullscreen={toggleFullscreen}
								/>
							)}
						</div>
					</main>

					{/* One-time QR login removed for inventory kiosk */}
				</div>
			</KioskContainer>
		</ErrorBoundary>
	);
}

export default App;
