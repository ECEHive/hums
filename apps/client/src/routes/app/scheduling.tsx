import { trpc } from "@ecehive/trpc/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import React from "react";
import { RequirePermissions, useCurrentUser } from "@/auth/AuthProvider";
import { MissingPermissions } from "@/components/missing-permissions";
import { PeriodSelector } from "@/components/periods/period-selector";
import { SchedulingTimeline } from "@/components/shift-schedules/scheduling-timeline";
import { ShiftDetailSheet } from "@/components/shift-schedules/shift-detail-sheet";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { checkPermissions } from "@/lib/permissions";

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
	const currentUser = useCurrentUser();
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

	// Check if user has register or unregister permissions
	const canRegister =
		currentUser && checkPermissions(currentUser, ["shift_schedules.register"]);
	const canUnregister =
		currentUser &&
		checkPermissions(currentUser, ["shift_schedules.unregister"]);

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

	// Check visibility window
	const isWithinVisibilityWindow = React.useMemo(() => {
		if (!schedulesData?.period) return true;

		const now = new Date();
		const { visibleStart, visibleEnd } = schedulesData.period;

		// If no visibility window is defined, always allow access
		if (!visibleStart && !visibleEnd) return true;

		// Check if current time is within the visibility window
		if (visibleStart && new Date(visibleStart) > now) return false;
		if (visibleEnd && new Date(visibleEnd) < now) return false;

		return true;
	}, [schedulesData]);

	// Check if user can access the page
	const canAccessPage =
		(canRegister || canUnregister) && isWithinVisibilityWindow;

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

	if (!canAccessPage) {
		return (
			<div className="container mx-auto py-8 px-4">
				<Card>
					<CardHeader>
						<CardTitle>Shift Scheduling</CardTitle>
					</CardHeader>
					<CardContent>
						<Alert variant="destructive">
							<AlertTitle>Access Restricted</AlertTitle>
							<AlertDescription>
								{!isWithinVisibilityWindow
									? "The selected period is not currently visible. Please check back during the visibility window."
									: "You do not have permission to register or unregister for shifts."}
							</AlertDescription>
						</Alert>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className="container mx-auto py-8 px-4 space-y-6">
			<Field>
				<PeriodSelector
					selectedPeriodId={selectedPeriodId}
					onPeriodChange={setSelectedPeriodId}
				/>
			</Field>

			{selectedPeriodId && isWithinVisibilityWindow && (
				<Card className="max-w-full">
					<CardHeader>
						<CardTitle>Available Shifts</CardTitle>
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
			/>
		</div>
	);
}
