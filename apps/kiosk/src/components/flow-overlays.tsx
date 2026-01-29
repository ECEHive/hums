import { Clock, LogOut, RefreshCw, Users } from "lucide-react";
import type { ReactNode } from "react";
import { AgreementFlow } from "@/components/agreement-flow";
import { EarlyLeaveConfirmation } from "@/components/early-leave-confirmation";
import { ErrorDialog } from "@/components/error-dialog";
import type { SelectionOverlayOption } from "@/components/session-type-selector";
import { SelectionOverlay } from "@/components/session-type-selector";
import { ShiftEarlyLeaveConfirmation } from "@/components/shift-early-leave-confirmation";
import { SuspensionDialog } from "@/components/suspension-dialog";
import { TapNotification } from "@/components/tap-notification";
import type {
	EarlyLeaveConfirmationState,
	ErrorDialogState,
	PendingAgreementState,
	SessionTypeSelectionState,
	ShiftEarlyLeaveConfirmationState,
	SuspensionState,
	TapNotificationState,
	TapOutActionSelectionState,
} from "@/hooks/use-tap-workflow";
import { Badge } from "./ui/badge";

interface FlowOverlaysProps {
	errorDialog: ErrorDialogState;
	sessionTypeSelection: SessionTypeSelectionState | null;
	tapOutActionSelection: TapOutActionSelectionState | null;
	earlyLeaveConfirmation: EarlyLeaveConfirmationState | null;
	shiftEarlyLeaveConfirmation: ShiftEarlyLeaveConfirmationState | null;
	pendingAgreement: PendingAgreementState | null;
	tapNotification: TapNotificationState;
	suspension: SuspensionState | null;
	onSessionTypeSelect: (type: "regular" | "staffing") => void;
	onSessionTypeCancel: () => void;
	onTapOutActionSelect: (
		action: "end_session" | "switch_to_staffing" | "switch_to_regular",
	) => void;
	onTapOutActionCancel: () => void;
	onEarlyLeaveConfirm: () => void;
	onEarlyLeaveCancel: () => void;
	onShiftEarlyLeaveConfirm: () => void;
	onShiftEarlyLeaveCancel: () => void;
	onAgreementComplete: () => void;
	onAgreementCancel: () => void;
	onAgreementError: (message: string) => void;
	onAgreementProgress: () => void;
}

export function FlowOverlays({
	errorDialog,
	sessionTypeSelection,
	tapOutActionSelection,
	earlyLeaveConfirmation,
	shiftEarlyLeaveConfirmation,
	pendingAgreement,
	tapNotification,
	suspension,
	onSessionTypeSelect,
	onSessionTypeCancel,
	onTapOutActionSelect,
	onTapOutActionCancel,
	onEarlyLeaveConfirm,
	onEarlyLeaveCancel,
	onShiftEarlyLeaveConfirm,
	onShiftEarlyLeaveCancel,
	onAgreementComplete,
	onAgreementCancel,
	onAgreementError,
	onAgreementProgress,
}: FlowOverlaysProps) {
	const hasBlockingOverlay =
		!!errorDialog.message ||
		!!pendingAgreement ||
		!!sessionTypeSelection ||
		!!tapOutActionSelection ||
		!!earlyLeaveConfirmation ||
		!!shiftEarlyLeaveConfirmation ||
		!!suspension;

	type OverlayConfig = {
		key: "session" | "tapout";
		header: ReactNode;
		options: SelectionOverlayOption[];
		onCancel: () => void;
	} | null;

	const overlayConfig: OverlayConfig = (() => {
		if (sessionTypeSelection) {
			const options: SelectionOverlayOption[] = [
				{
					id: "regular",
					icon: Clock,
					colorClass: "text-orange-500",
					borderClass: "hover:border-orange-500",
					title: "Regular",
					description: "Session for utilizing the space",
					onSelect: () => onSessionTypeSelect("regular"),
				},
				{
					id: "staffing",
					icon: Users,
					colorClass: "text-purple-500",
					borderClass: "hover:border-purple-500",
					title: "Staffing",
					description: "Session for staffing a shift",
					onSelect: () => onSessionTypeSelect("staffing"),
				},
			];

			return {
				key: "session",
				header: (
					<div className="text-center gap-2 flex flex-col">
						<h2 className="text-5xl font-bold">
							Welcome, {sessionTypeSelection.userName}!
						</h2>
						<p className="text-2xl text-muted-foreground">
							Select your session type
						</p>
					</div>
				),
				options,
				onCancel: onSessionTypeCancel,
			};
		}

		if (tapOutActionSelection) {
			const isStaffing =
				tapOutActionSelection.currentSessionType === "staffing";
			const switchColor = isStaffing ? "text-orange-500" : "text-purple-500";
			const switchBorder = isStaffing
				? "hover:border-orange-500"
				: "hover:border-purple-500";

			const options: SelectionOverlayOption[] = [
				{
					id: "leave",
					icon: LogOut,
					colorClass: "text-blue-500",
					borderClass: "hover:border-blue-500",
					title: "Leave",
					description: "End your current session",
					onSelect: () => onTapOutActionSelect("end_session"),
				},
				{
					id: "switch",
					icon: RefreshCw,
					colorClass: switchColor,
					borderClass: switchBorder,
					title: isStaffing ? "Switch to Regular" : "Switch to Staffing",
					description: isStaffing
						? "End session and start regular"
						: "End session and start staffing",
					onSelect: () =>
						onTapOutActionSelect(
							isStaffing ? "switch_to_regular" : "switch_to_staffing",
						),
				},
			];

			return {
				key: "tapout",
				header: (
					<div className="text-center gap-2 flex flex-col">
						<h2 className="text-5xl font-bold">
							Goodbye, {tapOutActionSelection.userName}!
						</h2>
						<div className="flex items-center justify-center gap-2">
							<p className="text-2xl text-muted-foreground">Current session:</p>
							<Badge variant="outline" className="text-md">
								{tapOutActionSelection.currentSessionType === "regular"
									? "Regular"
									: "Staffing"}
							</Badge>
						</div>
					</div>
				),
				options,
				onCancel: onTapOutActionCancel,
			};
		}

		return null;
	})();

	return (
		<>
			{errorDialog.message && (
				<ErrorDialog
					message={errorDialog.message}
					isExiting={errorDialog.isExiting}
				/>
			)}

			{suspension && (
				<SuspensionDialog
					userName={suspension.userName}
					endDate={suspension.endDate}
					externalNotes={suspension.externalNotes}
					isExiting={suspension.isExiting}
				/>
			)}

			{overlayConfig && (
				<SelectionOverlay
					key={overlayConfig.key}
					header={overlayConfig.header}
					options={overlayConfig.options}
					onCancel={overlayConfig.onCancel}
				/>
			)}

			{earlyLeaveConfirmation && (
				<EarlyLeaveConfirmation
					userName={earlyLeaveConfirmation.userName}
					onConfirm={onEarlyLeaveConfirm}
					onCancel={onEarlyLeaveCancel}
				/>
			)}

			{shiftEarlyLeaveConfirmation && (
				<ShiftEarlyLeaveConfirmation
					userName={shiftEarlyLeaveConfirmation.userName}
					action={shiftEarlyLeaveConfirmation.action}
					onConfirm={onShiftEarlyLeaveConfirm}
					onCancel={onShiftEarlyLeaveCancel}
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
