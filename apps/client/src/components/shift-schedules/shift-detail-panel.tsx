import { trpc } from "@ecehive/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
	Check,
	ChevronDown,
	Clock,
	Info,
	MapPin,
	Users,
	X,
} from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { formatTimeRange } from "@/lib/timezone";
import { cn } from "@/lib/utils";
import {
	DAYS_OF_WEEK,
	formatCompactTime,
	type ShiftSchedule,
} from "./shift-scheduler-utils";

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

// Shared hook for mutations
function useShiftMutations(periodId: number) {
	const queryClient = useQueryClient();

	const registerMutation = useMutation({
		mutationFn: async (shiftScheduleId: number) => {
			return trpc.shiftSchedules.register.mutate({ shiftScheduleId });
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["schedulesForRegistration", periodId],
			});
			toast.success("Successfully registered!");
		},
		onError: (error) => {
			toast.error(error.message || "Failed to register");
		},
	});

	const unregisterMutation = useMutation({
		mutationFn: async (shiftScheduleId: number) => {
			return trpc.shiftSchedules.unregister.mutate({ shiftScheduleId });
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["schedulesForRegistration", periodId],
			});
			toast.success("Successfully unregistered");
		},
		onError: (error) => {
			toast.error(error.message || "Failed to unregister");
		},
	});

	return { registerMutation, unregisterMutation };
}

// Shared schedule card component
function ShiftScheduleCard({
	schedule,
	isWithinSignupWindow,
	registerMutation,
	unregisterMutation,
}: {
	schedule: ShiftSchedule;
	isWithinSignupWindow: boolean;
	registerMutation: ReturnType<typeof useShiftMutations>["registerMutation"];
	unregisterMutation: ReturnType<
		typeof useShiftMutations
	>["unregisterMutation"];
}) {
	return (
		<div
			className={cn(
				"rounded-xl border-2 p-4 transition-all",
				schedule.isRegistered
					? "border-primary bg-primary/5"
					: schedule.canRegister
						? "border-green-500/50 bg-green-50/50 dark:bg-green-950/20"
						: "border-muted bg-muted/20",
			)}
		>
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0 flex-1">
					<div className="mb-2 flex items-center gap-2">
						{schedule.shiftTypeColor && (
							<div
								className="h-3 w-3 rounded-full shadow-sm ring-2 ring-white dark:ring-gray-800"
								style={{ backgroundColor: schedule.shiftTypeColor }}
							/>
						)}
						<h4 className="truncate font-semibold">{schedule.shiftTypeName}</h4>
						{schedule.isRegistered && (
							<Badge
								variant="default"
								className="shrink-0 bg-primary text-primary-foreground"
							>
								<Check className="mr-1 h-3 w-3" />
								Registered
							</Badge>
						)}
					</div>

					<div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
						<span className="flex items-center gap-1">
							<Clock className="h-3.5 w-3.5" />
							{formatTimeRange(schedule.startTime, schedule.endTime)}
						</span>
						<span className="flex items-center gap-1">
							<MapPin className="h-3.5 w-3.5" />
							{schedule.shiftTypeLocation}
						</span>
					</div>

					{/* Slot visualization */}
					<div className="mt-3">
						<div className="mb-1.5 flex items-center gap-2">
							<Users className="h-3.5 w-3.5 text-muted-foreground" />
							<span className="text-xs text-muted-foreground">
								{schedule.slots - schedule.availableSlots} / {schedule.slots}{" "}
								filled
							</span>
						</div>
						<div className="flex gap-1">
							{Array.from({ length: schedule.slots }, (_, i) => {
								const isFilled = i < schedule.slots - schedule.availableSlots;
								return (
									<div
										key={i}
										className={cn(
											"h-2 max-w-8 flex-1 rounded-full transition-colors",
											isFilled ? "bg-muted-foreground/60" : "bg-green-500/60",
										)}
									/>
								);
							})}
						</div>
					</div>

					{/* Registration blockers */}
					{!schedule.canRegister && !schedule.isRegistered && (
						<div className="mt-3 space-y-1 text-xs text-muted-foreground">
							{!isWithinSignupWindow && (
								<p className="flex items-center gap-1">
									<Info className="h-3 w-3" /> Outside signup window
								</p>
							)}
							{!schedule.canSelfAssign && (
								<p className="flex items-center gap-1">
									<Info className="h-3 w-3" /> Admin assignment only
								</p>
							)}
							{schedule.availableSlots === 0 && (
								<p className="flex items-center gap-1">
									<Info className="h-3 w-3" /> Fully booked
								</p>
							)}
							{schedule.hasTimeOverlap && (
								<p className="flex items-center gap-1">
									<Info className="h-3 w-3" /> Time conflict
								</p>
							)}
							{schedule.blockedByMaxRequirement && (
								<p className="flex items-center gap-1">
									<Info className="h-3 w-3" /> Max limit reached
								</p>
							)}
						</div>
					)}
				</div>

				<div className="shrink-0">
					{schedule.isRegistered ? (
						<Button
							size="sm"
							variant="destructive"
							onClick={() => unregisterMutation.mutate(schedule.id)}
							disabled={unregisterMutation.isPending || !schedule.canUnregister}
							className="rounded-lg"
						>
							{unregisterMutation.isPending ? (
								<Spinner className="h-4 w-4" />
							) : (
								"Drop"
							)}
						</Button>
					) : schedule.canRegister ? (
						<Button
							size="sm"
							onClick={() => registerMutation.mutate(schedule.id)}
							disabled={registerMutation.isPending}
							className="rounded-lg bg-green-600 text-white hover:bg-green-700"
						>
							{registerMutation.isPending ? (
								<Spinner className="h-4 w-4" />
							) : (
								"Register"
							)}
						</Button>
					) : (
						<Button
							size="sm"
							variant="secondary"
							disabled
							className="rounded-lg"
						>
							Unavailable
						</Button>
					)}
				</div>
			</div>
		</div>
	);
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

			<div className="flex-1 space-y-3 overflow-y-auto p-4">
				{schedules.map((schedule) => (
					<ShiftScheduleCard
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
			<div className="flex-1 space-y-3 overflow-y-auto p-4">
				{schedules.map((schedule) => (
					<ShiftScheduleCard
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
