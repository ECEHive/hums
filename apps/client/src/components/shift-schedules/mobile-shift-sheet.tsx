import { trpc } from "@ecehive/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Clock, Info, MapPin, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { formatTimeRange } from "@/lib/timezone";
import { cn } from "@/lib/utils";
import {
	DAYS_OF_WEEK,
	formatCompactTime,
	type ShiftSchedule,
} from "./shift-scheduler-utils";

interface MobileShiftSheetProps {
	open: boolean;
	onClose: () => void;
	schedules: ShiftSchedule[];
	dayOfWeek: number;
	timeBlock: number;
	periodId: number;
	isWithinSignupWindow: boolean;
}

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

function ShiftCard({
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

					<div className="mt-3">
						<div className="mb-1.5 flex items-center gap-2">
							<Users className="h-3.5 w-3.5 text-muted-foreground" />
							<span className="text-xs text-muted-foreground">
								{schedule.slots - schedule.availableSlots} / {schedule.slots}{" "}
								filled
							</span>
						</div>
						<div className="flex gap-1">
							{Array.from({ length: schedule.slots }, (_, i) => (
								<div
									key={i}
									className={cn(
										"h-2 max-w-8 flex-1 rounded-full transition-colors",
										i < schedule.slots - schedule.availableSlots
											? "bg-muted-foreground/60"
											: "bg-green-500/60",
									)}
								/>
							))}
						</div>
						{schedule.users.length > 0 && (
							<div className="mt-1.5 text-xs text-muted-foreground">
								{schedule.users.map((user) => user.name).join(", ")}
							</div>
						)}
					</div>

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

export function MobileShiftSheet({
	open,
	onClose,
	schedules,
	dayOfWeek,
	timeBlock,
	periodId,
	isWithinSignupWindow,
}: MobileShiftSheetProps) {
	const day = DAYS_OF_WEEK.find((d) => d.value === dayOfWeek);
	const timeLabel = formatCompactTime(timeBlock);
	const { registerMutation, unregisterMutation } = useShiftMutations(periodId);

	return (
		<Sheet
			open={open}
			onOpenChange={(isOpen) => {
				if (!isOpen) onClose();
			}}
		>
			<SheetContent
				side="bottom"
				className="h-[85vh] overflow-hidden p-0 [&>button]:hidden"
			>
				<SheetHeader className="relative border-b px-4 py-3">
					<Button
						variant="ghost"
						size="icon"
						onClick={onClose}
						className="absolute right-2 top-2 h-14 w-14"
					>
						<X className="h-5 w-5" />
						<span className="sr-only">Close</span>
					</Button>
					<SheetTitle>
						{day?.label} at {timeLabel}
					</SheetTitle>
					<SheetDescription>
						{schedules.length} shift{schedules.length !== 1 ? "s" : ""}{" "}
						available
					</SheetDescription>
				</SheetHeader>

				<div className="flex-1 space-y-3 overflow-y-auto p-4">
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
			</SheetContent>
		</Sheet>
	);
}
