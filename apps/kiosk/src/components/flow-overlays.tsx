import { AgreementFlow } from "@/components/agreement-flow";
import { ErrorDialog } from "@/components/error-dialog";
import { SessionTypeSelector } from "@/components/session-type-selector";
import { TapNotification } from "@/components/tap-notification";
import { TapOutActionSelector } from "@/components/tap-out-action-selector";
import type {
	ErrorDialogState,
	PendingAgreementState,
	SessionTypeSelectionState,
	TapNotificationState,
	TapOutActionSelectionState,
} from "@/hooks/use-tap-workflow";

interface FlowOverlaysProps {
	errorDialog: ErrorDialogState;
	sessionTypeSelection: SessionTypeSelectionState | null;
	tapOutActionSelection: TapOutActionSelectionState | null;
	pendingAgreement: PendingAgreementState | null;
	tapNotification: TapNotificationState;
	onSessionTypeSelect: (type: "regular" | "staffing") => void;
	onSessionTypeCancel: () => void;
	onTapOutActionSelect: (
		action: "end_session" | "switch_to_staffing" | "switch_to_regular",
	) => void;
	onTapOutActionCancel: () => void;
	onAgreementComplete: () => void;
	onAgreementCancel: () => void;
	onAgreementError: (message: string) => void;
	onAgreementProgress: () => void;
}

export function FlowOverlays({
	errorDialog,
	sessionTypeSelection,
	tapOutActionSelection,
	pendingAgreement,
	tapNotification,
	onSessionTypeSelect,
	onSessionTypeCancel,
	onTapOutActionSelect,
	onTapOutActionCancel,
	onAgreementComplete,
	onAgreementCancel,
	onAgreementError,
	onAgreementProgress,
}: FlowOverlaysProps) {
	const hasBlockingOverlay =
		!!errorDialog.message ||
		!!pendingAgreement ||
		!!sessionTypeSelection ||
		!!tapOutActionSelection;

	return (
		<>
			{errorDialog.message && (
				<ErrorDialog
					message={errorDialog.message}
					isExiting={errorDialog.isExiting}
				/>
			)}

			{sessionTypeSelection && (
				<SessionTypeSelector
					userName={sessionTypeSelection.userName}
					onSelectType={onSessionTypeSelect}
					onCancel={onSessionTypeCancel}
				/>
			)}

			{tapOutActionSelection && (
				<TapOutActionSelector
					userName={tapOutActionSelection.userName}
					currentSessionType={tapOutActionSelection.currentSessionType}
					onSelectAction={onTapOutActionSelect}
					onCancel={onTapOutActionCancel}
				/>
			)}

			{pendingAgreement && (
				<AgreementFlow
					agreements={pendingAgreement.agreements}
					userName={pendingAgreement.userName}
					cardNumber={pendingAgreement.cardNumber}
					onComplete={onAgreementComplete}
					onCancel={onAgreementCancel}
					onError={onAgreementError}
					onAgreementProgress={onAgreementProgress}
				/>
			)}

			{tapNotification.event && !hasBlockingOverlay && (
				<TapNotification
					event={tapNotification.event}
					isExiting={tapNotification.isExiting}
				/>
			)}
		</>
	);
}
