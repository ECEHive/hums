import { trpc } from "@ecehive/trpc/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import React from "react";
import { PeriodNotSelected } from "@/components/errors/period-not-selected";
import { RequireShiftAccess } from "@/components/guards/require-shift-access";
import { Page, PageContent, PageHeader, PageTitle } from "@/components/layout";
import { usePeriod } from "@/components/providers/period-provider";
import { SchedulingTimeline } from "@/components/shift-schedules/scheduling-timeline";
import { ShiftDetailSheet } from "@/components/shift-schedules/shift-detail-sheet";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import type { RequiredPermissions } from "@/lib/permissions";
import { formatInAppTimezone } from "@/lib/timezone";

export const Route = createFileRoute("/shifts/scheduling")({
	component: () => (
		<RequireShiftAccess>
			<Scheduling />
		</RequireShiftAccess>
	),
});

export const permissions = [] as RequiredPermissions;

interface SelectedBlock {
	dayOfWeek: number;
	timeBlock: string;
}

const requirementUnitLabels = {
	count: "shifts",
	hours: "hours",
	minutes: "minutes",
} as const;

function Scheduling() {
	const queryClient = useQueryClient();
	const { period: selectedPeriodId } = usePeriod();
	const [selectedBlock, setSelectedBlock] =
		React.useState<SelectedBlock | null>(null);
	const [sheetOpen, setSheetOpen] = React.useState(false);

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
	const {
		data: schedulesData,
		isLoading: schedulesLoading,
		isError: schedulesError,
		error: schedulesErrorObj,
	} = useQuery({
		queryKey: ["schedulesForRegistration", selectedPeriodId],
		queryFn: async () => {
			if (!selectedPeriodId) return null;
			return trpc.shiftSchedules.listForRegistration.query({
				periodId: selectedPeriodId,
			});
		},
		enabled: !!selectedPeriodId,
		retry: (failureCount, error) => {
			// Don't retry on 403 FORBIDDEN errors (visibility window)
			if (error && typeof error === "object" && "data" in error) {
				const trpcError = error as { data?: { httpStatus?: number } };
				if (trpcError.data?.httpStatus === 403) {
					return false;
				}
			}
			// For other errors, retry up to 3 times (default behavior)
			return failureCount < 3;
		},
	});

	// Get time window status from server response
	const isWithinSignupWindow = schedulesData?.isWithinSignupWindow ?? false;
	const isWithinVisibilityWindow =
		schedulesData?.isWithinVisibilityWindow ?? true;

	// Format window information for display
	const getWindowMessage = () => {
		if (!schedulesData?.period) return null;

		const { scheduleSignupStart, scheduleSignupEnd } = schedulesData.period;

		if (!isWithinSignupWindow) {
			const now = new Date();
			const signupStartDate = new Date(scheduleSignupStart);
			const signupEndDate = new Date(scheduleSignupEnd);
			if (signupStartDate > now) {
				return {
					type: "primary",
					title: "Registration Opens Soon",
					message: `Shift registration will open on ${formatInAppTimezone(signupStartDate)}`,
				};
			}
			if (signupEndDate < now) {
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

	const requirementProgress = schedulesData?.requirementProgress;
	const requirementUnit = requirementProgress?.unit ?? null;
	const requirementUnitLabel = requirementUnit
		? requirementUnitLabels[requirementUnit]
		: null;
	const requirementFormatter =
		requirementUnit === null
			? null
			: new Intl.NumberFormat(undefined, {
					maximumFractionDigits: requirementUnit === "hours" ? 1 : 0,
					minimumFractionDigits: 0,
				});

	const formatRequirementValue = (value: number | null | undefined) => {
		if (value === null || value === undefined || !requirementFormatter) {
			return null;
		}
		return requirementFormatter.format(value);
	};

	const currentDisplay = formatRequirementValue(requirementProgress?.current);
	const hasMinRequirement =
		requirementProgress?.min !== null && requirementProgress?.min !== undefined;
	const hasMaxRequirement =
		requirementProgress?.max !== null && requirementProgress?.max !== undefined;
	const minDisplay = formatRequirementValue(
		requirementProgress && hasMinRequirement ? requirementProgress.min : null,
	);
	const maxDisplay = formatRequirementValue(
		requirementProgress && hasMaxRequirement ? requirementProgress.max : null,
	);
	const progressPercentRaw = requirementProgress
		? (requirementProgress.minPercent ?? requirementProgress.maxPercent ?? 0)
		: 0;
	const progressPercent = Math.min(100, Math.max(0, progressPercentRaw ?? 0));

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

	if (selectedPeriodId === null) {
		return <PeriodNotSelected />;
	}

	return (
		<Page>
			<PageHeader>
				<PageTitle>Shift Scheduling</PageTitle>
			</PageHeader>

			<PageContent>
				{selectedPeriodId ? (
					isWithinVisibilityWindow ? (
						<>
							{requirementProgress && requirementUnitLabel && (
								<div className="rounded-md border border-border/70 bg-muted/20 p-3 text-xs sm:text-sm space-y-2">
									<div className="flex items-center justify-between text-[0.65rem] uppercase tracking-wide text-muted-foreground">
										<span>Requirement progress</span>
										<span>{requirementUnitLabel}</span>
									</div>
									<div className="space-y-1">
										<div className="flex items-center justify-between font-medium">
											<span>Current</span>
											<span>
												{currentDisplay ?? "0"}
												{hasMinRequirement && minDisplay
													? ` / ${minDisplay}`
													: hasMaxRequirement && maxDisplay
														? ` / ${maxDisplay}`
														: ""}{" "}
												{requirementUnitLabel}
											</span>
										</div>
										<Progress className="h-1.5" value={progressPercent} />
									</div>
									<div className="grid gap-2 sm:grid-cols-2 justify-between">
										<div className="flex items-center gap-2 text-muted-foreground">
											{hasMinRequirement && (
												<>
													<span>Min</span>
													<span className="font-medium text-foreground">
														{minDisplay
															? `${minDisplay} ${requirementUnitLabel}`
															: "–"}
													</span>
												</>
											)}
										</div>
										<div className="flex items-center justify-end gap-2 text-muted-foreground">
											{hasMaxRequirement && (
												<>
													<span>Max</span>
													<span className="font-medium text-foreground">
														{maxDisplay
															? `${maxDisplay} ${requirementUnitLabel}`
															: "–"}
														{requirementProgress.hasReachedMax
															? " (reached)"
															: ""}
													</span>
												</>
											)}
										</div>
									</div>
								</div>
							)}
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
									) : schedulesError ? (
										<Alert variant="destructive">
											<AlertTitle>Failed to load shifts</AlertTitle>
											<AlertDescription>
												{String(
													schedulesErrorObj?.message ??
														schedulesErrorObj ??
														"An unknown error occurred while loading shifts",
												)}
											</AlertDescription>
										</Alert>
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
			</PageContent>
		</Page>
	);
}
