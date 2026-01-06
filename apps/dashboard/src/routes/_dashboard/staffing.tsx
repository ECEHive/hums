import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
	AlertTriangle,
	Clock,
	MapPin,
	RefreshCw,
	User,
	UserCheck,
} from "lucide-react";
import { useDevice } from "@/components/providers/device-provider";
import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_dashboard/staffing")({
	component: StaffingPage,
});

function StaffingPage() {
	const { hasDashboardAccess, isLoading: deviceLoading } = useDevice();

	const { data, isLoading, error, dataUpdatedAt, isFetching } = useQuery({
		queryKey: ["dashboard", "currentStaffing"],
		queryFn: () => trpc.dashboard.currentStaffing.query({}),
		refetchInterval: 5 * 1000, // Refresh every 5 seconds for live updates
		enabled: hasDashboardAccess,
		staleTime: 3 * 1000, // Consider data stale after 3 seconds
	});

	// Show access denied if not a dashboard device
	if (!deviceLoading && !hasDashboardAccess) {
		return (
			<div className="flex items-center justify-center h-[50vh]">
				<Card className="max-w-md">
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<AlertTriangle className="h-5 w-5 text-destructive" />
							Access Restricted
						</CardTitle>
						<CardDescription>
							This page is only available to registered devices with dashboard
							access.
						</CardDescription>
					</CardHeader>
				</Card>
			</div>
		);
	}

	if (error) {
		return (
			<div className="flex items-center justify-center h-[50vh]">
				<Card className="max-w-md">
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<AlertTriangle className="h-5 w-5 text-destructive" />
							Error Loading Data
						</CardTitle>
						<CardDescription>
							Unable to load staffing information. Please try again later.
						</CardDescription>
					</CardHeader>
				</Card>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">Staffing</h1>
				</div>
				{/* Live update indicator */}
				<div className="flex items-center gap-2 text-xs text-muted-foreground">
					<RefreshCw
						className={`h-3 w-3 ${isFetching ? "animate-spin" : ""}`}
					/>
					<span>
						{isFetching
							? "Updating..."
							: `Updated ${formatRelativeTime(dataUpdatedAt)}`}
					</span>
				</div>
			</div>

			{/* Current Staff */}
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<div>
							<CardTitle className="flex items-center gap-2">
								<UserCheck className="h-5 w-5" />
								On Duty
							</CardTitle>
							<CardDescription>
								Currently active staffing sessions
							</CardDescription>
						</div>
						{!isLoading && data && (
							<Badge
								variant="secondary"
								className="text-base font-semibold px-3 py-1.5"
							>
								{data.currentStaffers.length}
							</Badge>
						)}
					</div>
				</CardHeader>
				<CardContent>
					{isLoading || deviceLoading ? (
						<div className="space-y-4">
							{[1, 2, 3].map((i) => (
								<div key={i} className="flex items-center gap-4">
									<Skeleton className="h-10 w-10 rounded-full" />
									<div className="space-y-2 flex-1">
										<Skeleton className="h-4 w-32" />
										<Skeleton className="h-3 w-48" />
									</div>
								</div>
							))}
						</div>
					) : data?.currentStaffers.length === 0 ? (
						<p className="text-muted-foreground text-center py-8">
							Nobody currently on duty
						</p>
					) : (
						<div className="space-y-4">
							{data?.currentStaffers.map((staffer) => (
								<div
									key={staffer.id}
									className="flex items-center gap-4 p-3 rounded-lg bg-muted/50"
								>
									<div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
										<User className="h-5 w-5 text-primary" />
									</div>
									<div className="flex-1">
										<div className="font-medium">{staffer.name}</div>
										{staffer.shiftInfo ? (
											<div className="flex items-center gap-2 text-sm text-muted-foreground">
												<MapPin className="h-3 w-3" />
												<span>{staffer.shiftInfo.shiftTypeName}</span>
												<span>•</span>
												<span>{staffer.shiftInfo.location}</span>
												{staffer.shiftInfo.status === "late" && (
													<Badge
														variant="outline"
														className="text-orange-500 border-orange-500"
													>
														Arrived Late
													</Badge>
												)}
											</div>
										) : (
											<div className="text-sm text-muted-foreground">
												Staffing (no scheduled shift)
											</div>
										)}
									</div>
								</div>
							))}
						</div>
					)}
				</CardContent>
			</Card>

			{/* Missing Staff */}
			{!isLoading && data && data.missingStaffers.length > 0 && (
				<Card className="border-destructive/50">
					<CardHeader>
						<CardTitle className="flex items-center gap-2 text-destructive">
							<AlertTriangle className="h-5 w-5" />
							Missing
						</CardTitle>
						<CardDescription>
							Assigned to current shifts but not checked in
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="space-y-4">
							{data.missingStaffers.map((missing, index) => (
								<div
									key={`${missing.user.id}-${index}`}
									className="flex items-center gap-4 p-3 rounded-lg bg-destructive/10"
								>
									<div className="h-10 w-10 rounded-full bg-destructive/20 flex items-center justify-center">
										<User className="h-5 w-5 text-destructive" />
									</div>
									<div className="flex-1">
										<div className="font-medium">{missing.user.name}</div>
										<div className="flex items-center gap-2 text-sm text-muted-foreground">
											<MapPin className="h-3 w-3" />
											<span>{missing.shiftType.name}</span>
											<span>•</span>
											<span>{missing.shiftType.location}</span>
										</div>
									</div>
									<Badge variant="destructive">Missing</Badge>
								</div>
							))}
						</div>
					</CardContent>
				</Card>
			)}

			{/* Upcoming Shifts */}
			{!isLoading && data && data.upcomingShifts.length > 0 && (
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Clock className="h-5 w-5" />
							Upcoming Shifts
						</CardTitle>
						<CardDescription>
							Shifts starting in the next 30 minutes
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="space-y-4">
							{data.upcomingShifts.map((shift, index) => (
								<div
									key={`${shift.user.id}-${index}`}
									className="flex items-center gap-4 p-3 rounded-lg bg-muted/50"
								>
									<div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
										<User className="h-5 w-5" />
									</div>
									<div className="flex-1">
										<div className="font-medium">{shift.user.name}</div>
										<div className="flex items-center gap-2 text-sm text-muted-foreground">
											<MapPin className="h-3 w-3" />
											<span>{shift.shiftType.name}</span>
											<span>•</span>
											<span>{shift.shiftType.location}</span>
										</div>
									</div>
									<Badge variant="outline" className="text-xs">
										{formatTime(shift.startTime)}
									</Badge>
								</div>
							))}
						</div>
					</CardContent>
				</Card>
			)}
		</div>
	);
}

function formatTime(date: Date | string): string {
	const d = new Date(date);
	return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatRelativeTime(timestamp: number): string {
	const seconds = Math.floor((Date.now() - timestamp) / 1000);
	if (seconds < 5) return "just now";
	if (seconds < 60) return `${seconds}s ago`;
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m ago`;
	return formatTime(new Date(timestamp));
}
