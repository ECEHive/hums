import { ErrorDialog } from "@/components/error-dialog";
import { ScanNotification } from "@/components/scan-notification";
import { SuccessNotification } from "@/components/success-notification";
import { SuspensionDialog } from "@/components/suspension-dialog";
import type {
	ErrorDialogState,
	ScanNotificationState,
	SuccessNotificationState,
	SuspensionState,
} from "@/hooks/use-inventory-workflow";

interface FlowOverlaysProps {
	errorDialog: ErrorDialogState;
	scanNotification: ScanNotificationState | null;
	successNotification: SuccessNotificationState | null;
	suspension: SuspensionState | null;
	// Agreement handlers removed
}

export function FlowOverlays({
	errorDialog,
	scanNotification,
	successNotification,
	suspension,
	// agreement handlers removed
}: FlowOverlaysProps) {
	return (
		<>
			{errorDialog.message && (
				<ErrorDialog
					message={errorDialog.message}
					isExiting={errorDialog.isExiting}
				/>
			)}

			{scanNotification && (
				<ScanNotification
					userName={scanNotification.userName}
					isExiting={scanNotification.isExiting}
				/>
			)}

			{successNotification && (
				<SuccessNotification
					message={successNotification.message}
					isExiting={successNotification.isExiting}
				/>
			)}

			{suspension && (
				<SuspensionDialog
					userName={suspension.userName}
					endDate={suspension.endDate}
					isExiting={suspension.isExiting}
				/>
			)}
		</>
	);
}
