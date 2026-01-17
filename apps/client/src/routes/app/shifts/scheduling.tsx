import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
	AlertCircle,
	CalendarCheck,
	CalendarDays,
	CalendarPlus,
	Check,
	Clock,
	MapPin,
	TrendingUp,
} from "lucide-react";
import React from "react";
import { PeriodNotSelected } from "@/components/errors/period-not-selected";
import { RequireShiftAccess } from "@/components/guards/require-shift-access";
import {
	Page,
	PageActions,
	PageContent,
	PageHeader,
	PageTitle,
} from "@/components/layout";
import { usePeriod } from "@/components/providers/period-provider";

import { FullPageScheduler } from "@/components/shift-schedules/full-page-scheduler";
import {
	getSchedulesQueryKey,
	useScheduleSubscription,
} from "@/components/shift-schedules/use-schedule-subscription";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { RequiredPermissions } from "@/lib/permissions";
import { formatInAppTimezone, formatTimeRange } from "@/lib/timezone";

export const Route = createFileRoute("/app/shifts/scheduling")({
	component: () => (
		<RequireShiftAccess>
			<Scheduling />
		</RequireShiftAccess>
	),
});

export const permissions = [] as RequiredPermissions;

const DAYS_OF_WEEK = [
	"Sunday",
	"Monday",
	"Tuesday",
	"Wednesday",
	"Thursday",
	"Friday",
	"Saturday",
];

const requirementUnitLabels = {
	count: "shifts",
	hours: "hours",
	minutes: "minutes",
} as const;

// Helper component for loading state
function LoadingState() {
	return (
		<div className="flex items-center justify-center py-24">
			<Spinner className="w-8 h-8" />
		</div>
	);
}

// Helper component for error state
function ErrorState({ error }: { error: unknown }) {
	return (
		<Alert variant="destructive">
			<AlertTitle>Failed to load shifts</AlertTitle>
			<AlertDescription>
				{String(
					(error as { message?: string })?.message ??
						error ??
						"An unknown error occurred while loading shifts",
				)}
			</AlertDescription>
		</Alert>
	);
}

// Helper component for period not visible state
function PeriodNotVisible() {
	return (
		<Card>
			<CardContent className="py-12">
				<div className="text-center">
					<CalendarDays className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
					<h3 className="text-lg font-semibold mb-2">Period Not Visible</h3>
					<p className="text-muted-foreground">
						The selected period is not currently visible. Please check back
						during the visibility window.
					</p>
				</div>
			</CardContent>
		</Card>
	);
}

// Helper component for registered shifts table
function RegisteredShiftsCard({
	registeredSchedules,
}: {
	registeredSchedules: Array<{
		id: number;
		shiftTypeName: string;
		shiftTypeColor: string | null;
		dayOfWeek: number;
		startTime: string;
		endTime: string;
		shiftTypeLocation: string | null;
	}>;
}) {
	if (registeredSchedules.length === 0) {
		return null;
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Your Registered Shifts</CardTitle>
				<CardDescription>
					Shifts you've registered for this period
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="overflow-hidden rounded-md border relative">
					<Table>
						<TableHeader className="bg-muted">
							<TableRow>
								<TableHead>Shift Type</TableHead>
								<TableHead>Day</TableHead>
								<TableHead>Time</TableHead>
								<TableHead>Location</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{registeredSchedules.map((schedule) => (
								<TableRow key={schedule.id}>
									<TableCell>
										<div className="flex items-center gap-2">
											{schedule.shiftTypeColor && (
												<div
													className="w-3 h-3 rounded-full shrink-0"
													style={{
														backgroundColor: schedule.shiftTypeColor,
													}}
												/>
											)}
											<span className="font-medium">
												{schedule.shiftTypeName}
											</span>
										</div>
									</TableCell>
									<TableCell>
										<div className="flex items-center gap-1.5">
											<CalendarDays className="w-4 h-4 text-muted-foreground" />
											{DAYS_OF_WEEK[schedule.dayOfWeek]}
										</div>
									</TableCell>
									<TableCell>
										<div className="flex items-center gap-1.5">
											<Clock className="w-4 h-4 text-muted-foreground" />
											{formatTimeRange(schedule.startTime, schedule.endTime)}
										</div>
									</TableCell>
									<TableCell className="text-muted-foreground">
										<div className="flex items-center gap-1.5">
											<MapPin className="w-4 h-4" />
											{schedule.shiftTypeLocation || "—"}
										</div>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>
			</CardContent>
		</Card>
	);
}

function Scheduling() {
	const { period: selectedPeriodId } = usePeriod();
	const [schedulerOpen, setSchedulerOpen] = React.useState(false);

	// Subscribe to real-time shift schedule updates with delta-based updates
	// This applies incremental changes instead of refetching all data
	const { connectionState, reconnect } = useScheduleSubscription({
		periodId: selectedPeriodId,
		enabled: !!selectedPeriodId,
	});

	// Fetch schedules for the selected period
	const {
		data: schedulesData,
		isLoading: schedulesLoading,
		isError: schedulesError,
		error: schedulesErrorObj,
	} = useQuery({
		queryKey: getSchedulesQueryKey(selectedPeriodId ?? 0),
		queryFn: async () => {
			if (!selectedPeriodId) return null;
			return trpc.shiftSchedules.listForRegistration.query({
				periodId: selectedPeriodId,
			});
		},
		enabled: !!selectedPeriodId,
		// Disable automatic refetch on reconnect since we handle this via subscriptions
		// This prevents the query from refetching (and potentially resetting UI state)
		// when the browser fires the 'online' event
		refetchOnReconnect: false,
		// Disable automatic refetch on window focus to prevent the scheduler dialog
		// from being disrupted when user navigates away and back to the page
		refetchOnWindowFocus: false,
		// Keep data fresh for a reasonable time since we get real-time updates via subscription
		staleTime: 1000 * 60 * 5, // 5 minutes
		retry: (failureCount, error) => {
			if (error && typeof error === "object" && "data" in error) {
				const trpcError = error as { data?: { httpStatus?: number } };
				if (trpcError.data?.httpStatus === 403) {
					return false;
				}
			}
			return failureCount < 3;
		},
	});

	const isWithinSignupWindow = schedulesData?.isWithinSignupWindow ?? false;
	const isWithinVisibilityWindow =
		schedulesData?.isWithinVisibilityWindow ?? true;

	// Get registered schedules
	const registeredSchedules = React.useMemo(() => {
		if (!schedulesData?.schedules) return [];
		return schedulesData.schedules
			.filter((s) => s.isRegistered)
			.sort((a, b) => {
				if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
				return a.startTime.localeCompare(b.startTime);
			});
	}, [schedulesData]);

	// Requirement progress
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

	// Window messages
	const getWindowMessage = () => {
		if (!schedulesData?.period) return null;

		const { scheduleSignupStart, scheduleSignupEnd } = schedulesData.period;

		if (!isWithinSignupWindow) {
			const now = new Date();
			const signupStartDate = new Date(scheduleSignupStart);
			const signupEndDate = new Date(scheduleSignupEnd);
			if (signupStartDate > now) {
				return {
					type: "info",
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
	const availableSchedules =
		schedulesData?.schedules?.filter((s) => s.canRegister).length ?? 0;

	if (selectedPeriodId === null) {
		return <PeriodNotSelected />;
	}

	return (
		<Page>
			<PageHeader>
				<PageTitle>Scheduling</PageTitle>
				<PageActions>
					{isWithinSignupWindow && (
						<Button onClick={() => setSchedulerOpen(true)} size="default">
							<CalendarPlus className="h-4 w-4 mr-2" />
							Open Scheduler
						</Button>
					)}
				</PageActions>
			</PageHeader>

			<PageContent>
				{schedulesLoading ? (
					<LoadingState />
				) : schedulesError ? (
					<ErrorState error={schedulesErrorObj} />
				) : !isWithinVisibilityWindow ? (
					<PeriodNotVisible />
				) : (
					<div className="space-y-6">
						{/* Status Alert */}
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

						{/* No Shifts Alert - Prominent call to action */}
						{isWithinSignupWindow &&
							(registeredSchedules.length === 0 || progressPercent < 100) && (
								<Alert className="border-primary/50 bg-primary/5">
									<AlertCircle className="h-4 w-4 text-primary" />
									<AlertTitle>
										{registeredSchedules.length === 0
											? "Get started with shift registration"
											: "Complete your shift requirements"}
									</AlertTitle>
									<AlertDescription className="mt-2 space-y-3">
										<p>
											{registeredSchedules.length === 0
												? "You haven't registered for any shifts yet. Open the scheduler to browse available shifts and start building your schedule."
												: "You haven't met your shift requirements yet. Open the scheduler to register for additional shifts."}
										</p>
										<Button onClick={() => setSchedulerOpen(true)} size="lg">
											{registeredSchedules.length === 0
												? "Start Registration"
												: "Finish Registration"}
										</Button>
									</AlertDescription>
								</Alert>
							)}
						{/* Summary Cards */}
						<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
							{/* Registered Shifts Count */}
							<Card>
								<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
									<CardTitle className="text-sm font-medium">
										Registered Shifts
									</CardTitle>
									<CalendarCheck className="h-4 w-4 text-muted-foreground" />
								</CardHeader>
								<CardContent>
									<div className="text-2xl font-bold">
										{registeredSchedules.length}
									</div>
									<p className="text-xs text-muted-foreground">
										shifts this period
									</p>
								</CardContent>
							</Card>

							{/* Available Shifts */}
							{isWithinSignupWindow && (
								<Card>
									<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
										<CardTitle className="text-sm font-medium">
											Available Shifts
										</CardTitle>
										<CalendarPlus className="h-4 w-4 text-muted-foreground" />
									</CardHeader>
									<CardContent>
										<div className="text-2xl font-bold">
											{availableSchedules}
										</div>
										<p className="text-xs text-muted-foreground">
											open for registration
										</p>
									</CardContent>
								</Card>
							)}

							{/* Progress Card */}
							{requirementProgress && requirementUnitLabel && (
								<Card
									className={
										isWithinSignupWindow
											? "md:col-span-2"
											: "md:col-span-2 lg:col-span-3"
									}
								>
									<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
										<CardTitle className="text-sm font-medium">
											Requirement Progress
										</CardTitle>
										<TrendingUp className="h-4 w-4 text-muted-foreground" />
									</CardHeader>
									<CardContent>
										<div className="text-2xl font-bold">
											{currentDisplay ?? "0"}
											{hasMinRequirement && minDisplay
												? ` / ${minDisplay}`
												: hasMaxRequirement && maxDisplay
													? ` / ${maxDisplay}`
													: ""}{" "}
											<span className="text-base font-medium text-muted-foreground">
												{requirementUnitLabel}
											</span>
										</div>
										<Progress value={progressPercent} className="h-2 mt-3" />
										{progressPercent >= 100 ? (
											<p className="text-xs text-green-600 dark:text-green-400 mt-2 flex items-center gap-1">
												<Check className="w-3 h-3" />
												Requirement met!
											</p>
										) : (
											<p className="text-xs text-muted-foreground mt-2">
												{progressPercent.toFixed(0)}% complete
											</p>
										)}
									</CardContent>
								</Card>
							)}
						</div>

						{/* Registered Shifts Table */}
						<RegisteredShiftsCard registeredSchedules={registeredSchedules} />
					</div>
				)}
				{/* Full Page Scheduler Modal */}
				{selectedPeriodId && (
					<FullPageScheduler
						open={schedulerOpen}
						onOpenChange={setSchedulerOpen}
						schedules={schedulesData?.schedules ?? []}
						isLoading={schedulesLoading}
						periodId={selectedPeriodId ?? 0}
						isWithinSignupWindow={isWithinSignupWindow}
						requirementProgress={schedulesData?.requirementProgress ?? null}
						connectionState={connectionState}
						onReconnect={reconnect}
					/>
				)}
			</PageContent>
		</Page>
	);
}
