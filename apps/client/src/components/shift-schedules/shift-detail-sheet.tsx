import { trpc } from "@ecehive/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ClockIcon, MapPinIcon } from "lucide-react";
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
import { cn } from "@/lib/utils";

interface ShiftSchedule {
	id: number;
	shiftTypeId: number;
	shiftTypeName: string;
	shiftTypeColor: string | null;
	shiftTypeLocation: string;
	slots: number;
	dayOfWeek: number;
	startTime: string;
	endTime: string;
	availableSlots: number;
	isRegistered: boolean;
	canRegister: boolean;
	canUnregister?: boolean;
	canSelfAssign: boolean;
	meetsRoleRequirement: boolean;
	meetsBalancingRequirement: boolean;
	hasTimeOverlap: boolean;
	users: { id: number; name: string }[];
}

interface ShiftDetailSheetProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	schedules: ShiftSchedule[];
	dayOfWeek: number;
	timeBlock: string;
	periodId: number;
	isWithinSignupWindow?: boolean;
}

const DAYS_OF_WEEK = [
	"Sunday",
	"Monday",
	"Tuesday",
	"Wednesday",
	"Thursday",
	"Friday",
	"Saturday",
];

/**
 * Format time from HH:MM to h:MM AM/PM
 */
function formatTime(time: string): string {
	const [hours, minutes] = time.split(":").map(Number);
	const period = hours >= 12 ? "PM" : "AM";
	const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
	return `${displayHours}:${minutes.toString().padStart(2, "0")} ${period}`;
}

export function ShiftDetailSheet({
	open,
	onOpenChange,
	schedules,
	dayOfWeek,
	timeBlock,
	periodId,
	isWithinSignupWindow = true,
}: ShiftDetailSheetProps) {
	const queryClient = useQueryClient();

	const registerMutation = useMutation({
		mutationFn: async (shiftScheduleId: number) => {
			return trpc.shiftSchedules.register.mutate({ shiftScheduleId });
		},
		onSuccess: () => {
			// Invalidate the schedules list to refresh availability
			queryClient.invalidateQueries({
				queryKey: ["schedulesForRegistration", periodId],
			});
			toast.success("Successfully registered for shift schedule");
		},
		onError: (error) => {
			toast.error(error.message || "Failed to register for shift schedule");
		},
	});

	const unregisterMutation = useMutation({
		mutationFn: async (shiftScheduleId: number) => {
			return trpc.shiftSchedules.unregister.mutate({ shiftScheduleId });
		},
		onSuccess: () => {
			// Invalidate the schedules list to refresh availability
			queryClient.invalidateQueries({
				queryKey: ["schedulesForRegistration", periodId],
			});
			toast.success("Successfully unregistered from shift schedule");
		},
		onError: (error) => {
			toast.error(error.message || "Failed to unregister from shift schedule");
		},
	});

	if (schedules.length === 0) {
		return null;
	}

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent className="overflow-y-auto">
				<SheetHeader>
					<SheetTitle>
						{DAYS_OF_WEEK[dayOfWeek]} - {timeBlock}
					</SheetTitle>
					<SheetDescription>
						Available shift schedules for this time block
					</SheetDescription>
				</SheetHeader>

				<div className="space-y-6 p-4">
					{schedules.map((schedule) => (
						<div key={schedule.id} className="border rounded-lg p-4 space-y-3">
							<div className="flex items-start justify-between gap-4">
								<div className="flex-1 space-y-2">
									<div className="flex items-center gap-2">
										<h3 className="font-semibold text-lg">
											{schedule.shiftTypeName}
										</h3>
										{schedule.shiftTypeColor && (
											<div
												className="w-4 h-4 rounded-full border"
												style={{ backgroundColor: schedule.shiftTypeColor }}
											/>
										)}
									</div>

									<div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
										<div className="flex items-center gap-1">
											<ClockIcon className="w-4 h-4" />
											<span>
												{formatTime(schedule.startTime)} -{" "}
												{formatTime(schedule.endTime)}
											</span>
										</div>
										<div className="flex items-center gap-1">
											<MapPinIcon className="w-4 h-4" />
											<span>{schedule.shiftTypeLocation}</span>
										</div>
									</div>
								</div>

								<div className="flex flex-col items-end gap-2">
									{schedule.isRegistered ? (
										<Button
											size="sm"
											variant="destructive"
											onClick={() => unregisterMutation.mutate(schedule.id)}
											disabled={
												unregisterMutation.isPending || !schedule.canUnregister
											}
										>
											{unregisterMutation.isPending ? (
												<Spinner className="w-4 h-4" />
											) : (
												"Unregister"
											)}
										</Button>
									) : schedule.canRegister ? (
										<Button
											size="sm"
											onClick={() => registerMutation.mutate(schedule.id)}
											disabled={registerMutation.isPending}
										>
											{registerMutation.isPending ? (
												<Spinner className="w-4 h-4" />
											) : (
												"Register"
											)}
										</Button>
									) : (
										<Button size="sm" variant="secondary" disabled>
											Unavailable
										</Button>
									)}
								</div>
							</div>

							<div className="pt-3 border-t">
								<div className="text-sm font-medium mb-2">
									Slots ({schedule.slots - schedule.availableSlots} /{" "}
									{schedule.slots} filled)
								</div>
								<div className="flex flex-col gap-2">
									{Array.from({ length: schedule.slots }, (_, i) => {
										const isFilled =
											i < schedule.slots - schedule.availableSlots;
										return (
											<div
												key={i}
												className={cn(
													"px-3 py-2 rounded-md text-sm flex flex-row items-center justify-between",
													isFilled
														? "bg-muted text-muted-foreground"
														: "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300",
												)}
											>
												{isFilled ? (
													<span>{schedule.users[i]?.name}</span>
												) : (
													<span>Available Slot</span>
												)}
											</div>
										);
									})}
								</div>
							</div>

							{!schedule.canRegister && !schedule.isRegistered && (
								<div className="pt-3 border-t space-y-1">
									<div className="text-sm font-medium text-muted-foreground">
										Why can't I register?
									</div>
									<ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
										{!isWithinSignupWindow && (
											<li>Registration is outside the signup window</li>
										)}
										{!schedule.canSelfAssign && (
											<li>
												Self-assignment is not allowed for this shift type
											</li>
										)}
										{!schedule.meetsRoleRequirement && (
											<li>You don't have the required role(s)</li>
										)}
										{!schedule.meetsBalancingRequirement && (
											<li>
												Registration is limited due to balancing restrictions
											</li>
										)}
										{schedule.availableSlots === 0 && (
											<li>All slots are filled</li>
										)}
										{schedule.hasTimeOverlap && (
											<li>
												This shift overlaps with another shift you are already
												registered for
											</li>
										)}
									</ul>
								</div>
							)}

							{schedule.isRegistered && (
								<>
									<Badge variant="default" className="w-fit">
										You are registered for this shift
									</Badge>
									{!schedule.canUnregister && (
										<div className="text-sm text-muted-foreground">
											{!schedule.canSelfAssign
												? "Note: An administrator must unassign you from this shift."
												: !isWithinSignupWindow
													? "Note: Unregistration is outside the signup window."
													: "Note: You cannot unregister from this shift at this time."}
										</div>
									)}
								</>
							)}
						</div>
					))}
				</div>
			</SheetContent>
		</Sheet>
	);
}
