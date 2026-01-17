import { ChevronDown, X } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ShiftCard } from "./shift-card";
import {
	DAYS_OF_WEEK,
	formatCompactTime,
	type ShiftSchedule,
} from "./shift-scheduler-utils";
import { useShiftMutations } from "./use-shift-mutations";

interface ShiftDetailPanelProps {
	schedules: ShiftSchedule[];
	dayOfWeek: number;
	timeBlock: number;
	periodId: number;
	isWithinSignupWindow: boolean;
	onClose: () => void;
}

interface MobileShiftDetailSheetProps extends ShiftDetailPanelProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

/**
 * Desktop sidebar panel - renders as a static sidebar with no overlay.
 * Only renders on desktop (md+) screens.
 */
export function DesktopShiftDetailPanel({
	schedules,
	dayOfWeek,
	timeBlock,
	periodId,
	isWithinSignupWindow,
	onClose,
}: ShiftDetailPanelProps) {
	const day = DAYS_OF_WEEK.find((d) => d.value === dayOfWeek);
	const timeLabel = formatCompactTime(timeBlock);
	const { registerMutation, unregisterMutation } = useShiftMutations(periodId);

	return (
		<div className="flex h-full flex-col">
			<div className="flex items-center justify-between border-b bg-card p-4">
				<div>
					<h3 className="text-lg font-semibold">
						{day?.label} at {timeLabel}
					</h3>
					<p className="text-sm text-muted-foreground">
						{schedules.length} shift{schedules.length !== 1 ? "s" : ""}{" "}
						available
					</p>
				</div>
				<Button
					variant="ghost"
					size="icon"
					onClick={onClose}
					className="shrink-0"
				>
					<X className="h-4 w-4" />
					<span className="sr-only">Close panel</span>
				</Button>
			</div>

			<div className="flex-1 space-y-3 overflow-y-auto p-4 pb-24">
				{schedules.map((schedule) => (
					<ShiftCard
						key={schedule.id}
						schedule={schedule}
						isWithinSignupWindow={isWithinSignupWindow}
						registerMutation={registerMutation}
						unregisterMutation={unregisterMutation}
					/>
				))}
			</div>
		</div>
	);
}

/**
 * Mobile sheet - renders as a bottom sheet with close button.
 * Only renders on mobile (<md) screens.
 * Uses a simple animated div to avoid nested dialog issues.
 */
export function MobileShiftDetailSheet({
	open,
	onOpenChange,
	schedules,
	dayOfWeek,
	timeBlock,
	periodId,
	isWithinSignupWindow,
	onClose,
}: MobileShiftDetailSheetProps) {
	const day = DAYS_OF_WEEK.find((d) => d.value === dayOfWeek);
	const timeLabel = formatCompactTime(timeBlock);
	const { registerMutation, unregisterMutation } = useShiftMutations(periodId);

	// Handle escape key to close
	useEffect(() => {
		if (!open) return;
		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				onOpenChange(false);
			}
		};
		document.addEventListener("keydown", handleEscape);
		return () => document.removeEventListener("keydown", handleEscape);
	}, [open, onOpenChange]);

	if (!open) return null;

	return (
		<div
			className={cn(
				"fixed inset-x-0 bottom-0 z-50 flex h-[85vh] flex-col rounded-t-xl border-t bg-background shadow-lg",
				"animate-in slide-in-from-bottom duration-300",
			)}
		>
			{/* Drag handle indicator */}
			<div className="flex justify-center pb-1 pt-2">
				<div className="h-1.5 w-12 rounded-full bg-muted-foreground/30" />
			</div>

			{/* Header with close button */}
			<div className="flex items-center justify-between border-b px-4 pb-3">
				<div>
					<h3 className="text-lg font-semibold">
						{day?.label} at {timeLabel}
					</h3>
					<p className="text-sm text-muted-foreground">
						{schedules.length} shift{schedules.length !== 1 ? "s" : ""}{" "}
						available
					</p>
				</div>
				<Button
					variant="ghost"
					size="icon"
					onClick={onClose}
					className="shrink-0"
				>
					<ChevronDown className="h-5 w-5" />
					<span className="sr-only">Close</span>
				</Button>
			</div>

			{/* Scrollable content */}
			<div className="flex-1 space-y-3 overflow-y-auto p-4 pb-24">
				{schedules.map((schedule) => (
					<ShiftCard
						key={schedule.id}
						schedule={schedule}
						isWithinSignupWindow={isWithinSignupWindow}
						registerMutation={registerMutation}
						unregisterMutation={unregisterMutation}
					/>
				))}
			</div>
		</div>
	);
}

// Legacy export for backwards compatibility
export const ShiftDetailPanel = DesktopShiftDetailPanel;
