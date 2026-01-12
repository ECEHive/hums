import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Activity, Users } from "lucide-react";
import { BusynessChart } from "@/components/charts/busyness-chart";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_dashboard/")({
	component: DashboardHome,
});

function DashboardHome() {
	const { data: sessionCount, isLoading: sessionsLoading } = useQuery({
		queryKey: ["dashboard", "activeSessionsCount"],
		queryFn: () => trpc.dashboard.activeSessionsCount.query({}),
		refetchInterval: 10 * 1000, // Refresh every 10 seconds for more live feel
	});

	const { data: busynessData, isLoading: busynessLoading } = useQuery({
		queryKey: ["dashboard", "busynessAnalytics"],
		queryFn: () => trpc.dashboard.busynessAnalytics.query({ weeksBack: 2 }),
		refetchInterval: 60 * 1000, // Refresh every minute
	});

	return (
		<div className="space-y-4 md:space-y-6">
			{/* Page Header */}
			<div>
				<h1 className="text-2xl md:text-3xl font-bold tracking-tight">
					Dashboard
				</h1>
				<p className="text-sm md:text-base text-muted-foreground">
					Real-time overview of the space
				</p>
			</div>

			{/* People in Space Card */}
			<Card>
				<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
					<CardTitle className="text-sm font-medium">Active Users</CardTitle>
					<Users className="h-4 w-4 text-muted-foreground" />
				</CardHeader>
				<CardContent>
					{sessionsLoading ? (
						<Skeleton className="h-10 w-24" />
					) : (
						<div className="text-3xl md:text-4xl font-bold tabular-nums">
							{sessionCount?.total ?? 0}
						</div>
					)}
					<p className="text-xs md:text-sm text-muted-foreground">
						Users currently in the space
					</p>
				</CardContent>
			</Card>

			{/* Busyness Chart - Google Maps style */}
			<Card>
				<CardHeader className="pb-2 md:pb-4">
					<div className="flex items-center gap-2">
						<Activity className="h-4 w-4 text-muted-foreground" />
						<CardTitle className="text-base md:text-lg">
							Popular Times
						</CardTitle>
					</div>
					<CardDescription className="text-xs md:text-sm">
						See how busy we typically are throughout the week
					</CardDescription>
				</CardHeader>
				<CardContent className="pt-0">
					{busynessLoading ? (
						<div className="space-y-4">
							<Skeleton className="h-10 w-full" />
							<Skeleton className="h-[160px] md:h-[200px] w-full" />
						</div>
					) : busynessData?.analytics ? (
						<BusynessChart
							data={busynessData.analytics}
							current={busynessData.current}
						/>
					) : (
						<div className="flex items-center justify-center h-[160px] text-muted-foreground">
							No data available
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
