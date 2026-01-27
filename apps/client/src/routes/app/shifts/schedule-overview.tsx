import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays, Eye, Users } from "lucide-react";
import React from "react";
import { RequirePermissions } from "@/auth/AuthProvider";
import { PeriodNotSelected } from "@/components/errors/period-not-selected";
import { MissingPermissions } from "@/components/guards/missing-permissions";
import {
	Page,
	PageActions,
	PageContent,
	PageHeader,
	PageTitle,
} from "@/components/layout";
import { usePeriod } from "@/components/providers/period-provider";
import { FullPageScheduleOverview } from "@/components/schedule-overview";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import type { RequiredPermissions } from "@/lib/permissions";

export const Route = createFileRoute("/app/shifts/schedule-overview")({
	component: () =>
		RequirePermissions({
			permissions,
			children: <ScheduleOverviewPage />,
			forbiddenFallback: <MissingPermissions />,
		}),
});

export const permissions = ["shift_schedules.list"] as RequiredPermissions;

function ScheduleOverviewPage() {
	const { period: periodId } = usePeriod();
	const [overviewOpen, setOverviewOpen] = React.useState(false);

	const {
		data: schedulesData,
		isLoading: schedulesLoading,
		error: schedulesError,
	} = useQuery({
		queryKey: ["schedulesForOverview", periodId],
		queryFn: () =>
			trpc.shiftSchedules.listForOverview.query({
				periodId: periodId as number,
			}),
		enabled: periodId !== null,
	});

	if (periodId === null) {
		return <PeriodNotSelected />;
	}

	if (schedulesLoading) {
		return (
			<div className="flex h-screen w-full items-center justify-center">
				<Spinner />
			</div>
		);
	}

	if (schedulesError) {
		return (
			<Page>
				<PageHeader>
					<PageTitle>Schedule Overview</PageTitle>
				</PageHeader>
				<PageContent>
					<Card className="border-destructive">
						<CardHeader>
							<CardTitle className="text-destructive">Error</CardTitle>
							<CardDescription>
								Failed to load schedule data. Please try again.
							</CardDescription>
						</CardHeader>
					</Card>
				</PageContent>
			</Page>
		);
	}

	const schedules = schedulesData?.schedules ?? [];
	const periodName = schedulesData?.period?.name ?? "Unknown Period";

	// Calculate summary statistics
	const totalSlots = schedules.reduce((sum, s) => sum + s.slots, 0);
	const filledSlots = schedules.reduce((sum, s) => sum + s.filledSlots, 0);
	const emptySlots = totalSlots - filledSlots;
	const fillPercent =
		totalSlots > 0 ? Math.round((filledSlots / totalSlots) * 100) : 0;

	// Count unique shift types
	const uniqueShiftTypes = new Set(schedules.map((s) => s.shiftTypeId)).size;

	// Count total unique users registered
	const uniqueUsers = new Set(
		schedules.flatMap((s) => s.users.map((u) => u.id)),
	).size;

	return (
		<Page>
			<PageHeader>
				<PageTitle>Schedule Overview</PageTitle>
				<PageActions>
					<Button onClick={() => setOverviewOpen(true)} className="gap-2">
						<Eye className="h-4 w-4" />
						<span className="hidden sm:inline">View Schedule</span>
						<span className="sm:hidden">View</span>
					</Button>
				</PageActions>
			</PageHeader>

			<PageContent>
				{/* Summary Cards */}
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
					{/* Total Slots */}
					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">Total Slots</CardTitle>
							<CalendarDays className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold">{totalSlots}</div>
							<p className="text-xs text-muted-foreground">
								across {uniqueShiftTypes} shift type
								{uniqueShiftTypes !== 1 ? "s" : ""}
							</p>
						</CardContent>
					</Card>

					{/* Filled Slots */}
					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">
								Filled Slots
							</CardTitle>
							<Users className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold">{filledSlots}</div>
							<p className="text-xs text-muted-foreground">
								{fillPercent}% of total capacity
							</p>
						</CardContent>
					</Card>

					{/* Empty Slots */}
					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">Empty Slots</CardTitle>
							<CalendarDays className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold">{emptySlots}</div>
							<p className="text-xs text-muted-foreground">
								{100 - fillPercent}% still available
							</p>
						</CardContent>
					</Card>

					{/* Registered Users */}
					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">
								Registered Users
							</CardTitle>
							<Users className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold">{uniqueUsers}</div>
							<p className="text-xs text-muted-foreground">
								unique users registered
							</p>
						</CardContent>
					</Card>
				</div>

				{/* Fill Progress */}
				<Card className="mt-4">
					<CardHeader>
						<CardTitle>Schedule Fill Rate</CardTitle>
						<CardDescription>
							Overall capacity utilization for {periodName}
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="space-y-2">
							<div className="flex items-center justify-between text-sm">
								<span className="text-muted-foreground">Progress</span>
								<span className="font-medium">
									{filledSlots} / {totalSlots} slots ({fillPercent}%)
								</span>
							</div>
							<div className="h-3 w-full rounded-full bg-muted overflow-hidden">
								<div
									className="h-full rounded-full bg-cyan-500 transition-all duration-500"
									style={{ width: `${fillPercent}%` }}
								/>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Quick Actions */}
				<Card className="mt-4">
					<CardHeader>
						<CardTitle>Quick Actions</CardTitle>
						<CardDescription>
							View and analyze the schedule heatmap
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Button
							variant="outline"
							onClick={() => setOverviewOpen(true)}
							className="w-full justify-start gap-2"
						>
							<Eye className="h-4 w-4" />
							Open Schedule Heatmap
						</Button>
					</CardContent>
				</Card>
			</PageContent>

			{/* Full Page Overview Modal */}
			<FullPageScheduleOverview
				open={overviewOpen}
				onOpenChange={setOverviewOpen}
				schedules={schedules}
				isLoading={schedulesLoading}
				periodName={periodName}
			/>
		</Page>
	);
}
