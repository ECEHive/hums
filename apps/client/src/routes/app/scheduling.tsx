import { trpc } from "@ecehive/trpc/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import React from "react";
import { RequirePermissions } from "@/auth/AuthProvider";
import { MissingPermissions } from "@/components/missing-permissions";
import { PeriodSelector } from "@/components/periods/period-selector";
import { SchedulingTimeline } from "@/components/shift-schedules/scheduling-timeline";
import { ShiftDetailSheet } from "@/components/shift-schedules/shift-detail-sheet";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

export const Route = createFileRoute("/app/scheduling")({
	component: () =>
		RequirePermissions({
			permissions,
			children: <Scheduling />,
			forbiddenFallback: <MissingPermissions />,
		}),
});

export const permissions = ["shift_schedules.register"];

interface SelectedBlock {
	dayOfWeek: number;
	timeBlock: string;
}

function Scheduling() {
	const queryClient = useQueryClient();
	const [selectedPeriodId, setSelectedPeriodId] = React.useState<number | null>(
		null,
	);
	const [selectedBlock, setSelectedBlock] =
		React.useState<SelectedBlock | null>(null);
	const [sheetOpen, setSheetOpen] = React.useState(false);

	// Get current period
	const { data: currentPeriodData } = useQuery({
		queryKey: ["currentPeriod"],
		queryFn: async () => {
			return trpc.periods.getCurrent.query();
		},
	});

	// Set selected period to current period on load
	React.useEffect(() => {
		if (currentPeriodData?.period && selectedPeriodId === null) {
			setSelectedPeriodId(currentPeriodData.period.id);
		}
	}, [currentPeriodData, selectedPeriodId]);

	// Subscribe to real-time shift schedule updates
	React.useEffect(() => {
		if (!selectedPeriodId) return;

		const unsubscribe = trpc.shiftSchedules.onScheduleUpdate.subscribe(
			{ periodId: selectedPeriodId },
			{
				onData: () => {
					// Invalidate the schedules query to refetch with updated data
					queryClient.invalidateQueries({
						queryKey: ["schedulesForRegistration", selectedPeriodId],
					});
				},
				onError: (err) => {
					console.error("Subscription error:", err);
				},
			},
		);

		return () => {
			unsubscribe.unsubscribe();
		};
	}, [selectedPeriodId, queryClient]);

	// Fetch schedules for the selected period
	const { data: schedulesData, isLoading: schedulesLoading } = useQuery({
		queryKey: ["schedulesForRegistration", selectedPeriodId],
		queryFn: async () => {
			if (!selectedPeriodId) return null;
			return trpc.shiftSchedules.listForRegistration.query({
				periodId: selectedPeriodId,
			});
		},
		enabled: !!selectedPeriodId,
	});

	// Get time window status from server response
	const isWithinSignupWindow = schedulesData?.isWithinSignupWindow ?? false;
	const isWithinVisibilityWindow =
		schedulesData?.isWithinVisibilityWindow ?? true;

	// Format window information for display
	const getWindowMessage = () => {
		if (!schedulesData?.period) return null;

		const { scheduleSignupStart, scheduleSignupEnd } = schedulesData.period;

		if (!isWithinSignupWindow && (scheduleSignupStart || scheduleSignupEnd)) {
			const now = new Date();
			if (scheduleSignupStart && new Date(scheduleSignupStart) > now) {
				return {
					type: "primary",
					title: "Registration Opens Soon",
					message: `Shift registration will open on ${new Date(scheduleSignupStart).toLocaleString()}`,
				};
			}
			if (scheduleSignupEnd && new Date(scheduleSignupEnd) < now) {
				return {
					type: "destructive",
					title: "Registration Closed",
					message: "The registration window for this period has ended",
				};
			}
		}

		return null;
	};

	const windowMessage = getWindowMessage();

	// Handle block click
	const handleBlockClick = (dayOfWeek: number, timeBlock: string) => {
		setSelectedBlock({ dayOfWeek, timeBlock });
		setSheetOpen(true);
	};

	// Parse timeBlock (HH:MM) to minutes
	const parseTimeToMinutes = (time: string): number => {
		const [hours, minutes] = time.split(":").map(Number);
		return hours * 60 + minutes;
	};

	// Get schedules for the selected block
	const selectedBlockSchedules = React.useMemo(() => {
		if (!selectedBlock || !schedulesData?.schedules) return [];

		const blockMinutes = parseTimeToMinutes(selectedBlock.timeBlock);

		return schedulesData.schedules.filter((schedule) => {
			if (schedule.dayOfWeek !== selectedBlock.dayOfWeek) return false;

			const startMinutes = parseTimeToMinutes(schedule.startTime);
			const endMinutes = parseTimeToMinutes(schedule.endTime);

			// Check if schedule overlaps with the block
			// We need to find what block size was used to determine the exact block range
			// For simplicity, we'll check if the schedule's start time matches the block start
			// or if it overlaps with a reasonable block range (we'll assume up to 60 minutes)
			return startMinutes <= blockMinutes && endMinutes > blockMinutes;
		});
	}, [selectedBlock, schedulesData]);

	return (
		<div className="container mx-auto p-4 space-y-4">
			<h1 className="text-2xl font-bold">Shift Scheduling</h1>

			<PeriodSelector
				selectedPeriodId={selectedPeriodId}
				onPeriodChange={setSelectedPeriodId}
				visibleOnly={true}
			/>

			{selectedPeriodId ? (
				isWithinVisibilityWindow ? (
					<>
						{windowMessage && (
							<Alert
								variant={
									windowMessage.type === "destructive"
										? "destructive"
										: "default"
								}
							>
								<AlertTitle>{windowMessage.title}</AlertTitle>
								<AlertDescription>{windowMessage.message}</AlertDescription>
							</Alert>
						)}
						<Card className="max-w-full">
							<CardHeader>
								<CardTitle>Available Shifts</CardTitle>
								{schedulesData?.period && (
									<div className="text-sm text-muted-foreground mt-2 space-y-1">
										{isWithinSignupWindow && (
											<p className="text-green-600 dark:text-green-400">
												✓ Registration is currently open
											</p>
										)}
									</div>
								)}
							</CardHeader>
							<CardContent>
								{schedulesLoading ? (
									<div className="flex items-center justify-center py-12">
										<Spinner className="w-8 h-8" />
									</div>
								) : (
									<SchedulingTimeline
										schedules={schedulesData?.schedules ?? []}
										isLoading={schedulesLoading}
										onBlockClick={handleBlockClick}
									/>
								)}
							</CardContent>
						</Card>
					</>
				) : (
					<Card className="max-w-full">
						<CardHeader>
							<CardTitle>Period Not Visible</CardTitle>
						</CardHeader>
						<CardContent>
							<Alert>
								<AlertTitle>Outside Visibility Window</AlertTitle>
								<AlertDescription>
									The selected period is not currently visible. Please check
									back during the visibility window.
								</AlertDescription>
							</Alert>
						</CardContent>
					</Card>
				)
			) : (
				<Card className="max-w-full">
					<CardHeader>
						<CardTitle>Shift Scheduling</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="flex items-center justify-center py-12">
							<p className="text-muted-foreground">
								Select a period to view available shifts
							</p>
						</div>
					</CardContent>
				</Card>
			)}

			<ShiftDetailSheet
				open={sheetOpen}
				onOpenChange={setSheetOpen}
				schedules={selectedBlockSchedules}
				dayOfWeek={selectedBlock?.dayOfWeek ?? 0}
				timeBlock={
					selectedBlock?.timeBlock
						? `${selectedBlock.timeBlock.split(":")[0]}:${selectedBlock.timeBlock.split(":")[1]}`
						: "00:00"
				}
				periodId={selectedPeriodId ?? 0}
				isWithinSignupWindow={isWithinSignupWindow}
			/>
		</div>
	);
}
