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

export const Route = createFileRoute("/_overview/staffing")({
	component: StaffingPage,
});

function StaffingPage() {
	const { hasDashboardAccess, isLoading: deviceLoading } = useDevice();

	const { data, isLoading, error, dataUpdatedAt, isFetching } = useQuery({
		queryKey: ["overview", "currentStaffing"],
		queryFn: () => trpc.overview.currentStaffing.query({}),
		refetchInterval: 5 * 1000, // Refresh every 5 seconds for live updates
		enabled: hasDashboardAccess,
		staleTime: 3 * 1000, // Consider data stale after 3 seconds
	});

	// Show access denied if not a dashboard device
	if (!deviceLoading && !hasDashboardAccess) {
		return (
			<div className="flex items-center justify-center min-h-[50vh] p-4">
				<Card className="max-w-md w-full">
					<CardHeader>
						<CardTitle className="flex items-center gap-2 text-base md:text-lg">
							<AlertTriangle className="h-5 w-5 text-destructive" />
							Access Restricted
						</CardTitle>
						<CardDescription className="text-sm">
							This page is only available to registered devices with overview
							access.
						</CardDescription>
					</CardHeader>
				</Card>
			</div>
		);
	}

	if (error) {
		return (
			<div className="flex items-center justify-center min-h-[50vh] p-4">
				<Card className="max-w-md w-full">
					<CardHeader>
						<CardTitle className="flex items-center gap-2 text-base md:text-lg">
							<AlertTriangle className="h-5 w-5 text-destructive" />
							Error Loading Data
						</CardTitle>
						<CardDescription className="text-sm">
							Unable to load staffing information. Please try again later.
						</CardDescription>
					</CardHeader>
				</Card>
			</div>
		);
	}

	return (
		<div className="space-y-4 md:space-y-6">
			{/* Page Header */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
				<div>
					<h1 className="text-2xl md:text-3xl font-bold tracking-tight">
						Staffing
					</h1>
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
				<CardHeader className="pb-2 md:pb-4">
					<div className="flex items-center justify-between">
						<div className="space-y-1">
							<CardTitle className="flex items-center gap-2 text-base md:text-lg">
								<UserCheck className="h-4 w-4 md:h-5 md:w-5" />
								On Duty
							</CardTitle>
							<CardDescription className="text-xs md:text-sm">
								Currently active staffing sessions
							</CardDescription>
						</div>
						{!isLoading && data && (
							<Badge
								variant="secondary"
								className="text-sm md:text-base font-semibold px-2.5 py-1 md:px-3 md:py-1.5"
							>
								{data.currentStaffers.length}
							</Badge>
						)}
					</div>
				</CardHeader>
				<CardContent>
					{isLoading || deviceLoading ? (
						<div className="space-y-3 md:space-y-4">
							{[1, 2, 3].map((i) => (
								<div key={i} className="flex items-center gap-3 md:gap-4">
									<Skeleton className="h-9 w-9 md:h-10 md:w-10 rounded-full" />
									<div className="space-y-1.5 md:space-y-2 flex-1">
										<Skeleton className="h-4 w-28 md:w-32" />
										<Skeleton className="h-3 w-40 md:w-48" />
									</div>
								</div>
							))}
						</div>
					) : data?.currentStaffers.length === 0 ? (
						<p className="text-muted-foreground text-center py-6 md:py-8 text-sm">
							Nobody currently on duty
						</p>
					) : (
						<div className="space-y-3 md:space-y-4">
							{data?.currentStaffers.map((staffer) => (
								<div
									key={staffer.id}
									className="flex items-center gap-3 md:gap-4 p-2.5 md:p-3 rounded-lg bg-muted/50"
								>
									<div className="h-9 w-9 md:h-10 md:w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
										<User className="h-4 w-4 md:h-5 md:w-5 text-primary" />
									</div>
									<div className="flex-1 min-w-0">
										<div className="font-medium text-sm md:text-base truncate">
											{staffer.name}
										</div>
										{staffer.shiftInfo ? (
											<div className="flex flex-wrap items-center gap-1.5 md:gap-2 text-xs md:text-sm text-muted-foreground">
												<span className="flex items-center gap-1">
													<MapPin className="h-3 w-3 shrink-0" />
													<span className="truncate">
														{staffer.shiftInfo.shiftTypeName}
													</span>
												</span>
												<span className="hidden sm:inline">•</span>
												<span className="hidden sm:inline truncate">
													{staffer.shiftInfo.location}
												</span>
												{staffer.shiftInfo.status === "late" && (
													<Badge
														variant="outline"
														className="text-orange-500 border-orange-500 text-xs px-1.5 py-0"
													>
														Late
													</Badge>
												)}
											</div>
										) : (
											<div className="text-xs md:text-sm text-muted-foreground">
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
					<CardHeader className="pb-2 md:pb-4">
						<CardTitle className="flex items-center gap-2 text-destructive text-base md:text-lg">
							<AlertTriangle className="h-4 w-4 md:h-5 md:w-5" />
							Missing
						</CardTitle>
						<CardDescription className="text-xs md:text-sm">
							Assigned to current shifts but not checked in
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="space-y-3 md:space-y-4">
							{data.missingStaffers.map((missing, index) => (
								<div
									key={`${missing.user.id}-${index}`}
									className="flex items-center gap-3 md:gap-4 p-2.5 md:p-3 rounded-lg bg-destructive/10"
								>
									<div className="h-9 w-9 md:h-10 md:w-10 rounded-full bg-destructive/20 flex items-center justify-center shrink-0">
										<User className="h-4 w-4 md:h-5 md:w-5 text-destructive" />
									</div>
									<div className="flex-1 min-w-0">
										<div className="font-medium text-sm md:text-base truncate">
											{missing.user.name}
										</div>
										<div className="flex flex-wrap items-center gap-1.5 md:gap-2 text-xs md:text-sm text-muted-foreground">
											<span className="flex items-center gap-1">
												<MapPin className="h-3 w-3 shrink-0" />
												<span className="truncate">
													{missing.shiftType.name}
												</span>
											</span>
											<span className="hidden sm:inline">•</span>
											<span className="hidden sm:inline truncate">
												{missing.shiftType.location}
											</span>
										</div>
									</div>
									<Badge
										variant="destructive"
										className="text-xs px-1.5 py-0.5 shrink-0"
									>
										Missing
									</Badge>
								</div>
							))}
						</div>
					</CardContent>
				</Card>
			)}

			{/* Upcoming Shifts */}
			{!isLoading && data && data.upcomingShifts.length > 0 && (
				<Card>
					<CardHeader className="pb-2 md:pb-4">
						<CardTitle className="flex items-center gap-2 text-base md:text-lg">
							<Clock className="h-4 w-4 md:h-5 md:w-5" />
							Upcoming Shifts
						</CardTitle>
						<CardDescription className="text-xs md:text-sm">
							Shifts starting in the next 30 minutes
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="space-y-3 md:space-y-4">
							{data.upcomingShifts.map((shift, index) => (
								<div
									key={`${shift.user.id}-${index}`}
									className="flex items-center gap-3 md:gap-4 p-2.5 md:p-3 rounded-lg bg-muted/50"
								>
									<div className="h-9 w-9 md:h-10 md:w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
										<User className="h-4 w-4 md:h-5 md:w-5" />
									</div>
									<div className="flex-1 min-w-0">
										<div className="font-medium text-sm md:text-base truncate">
											{shift.user.name}
										</div>
										<div className="flex flex-wrap items-center gap-1.5 md:gap-2 text-xs md:text-sm text-muted-foreground">
											<span className="flex items-center gap-1">
												<MapPin className="h-3 w-3 shrink-0" />
												<span className="truncate">{shift.shiftType.name}</span>
											</span>
											<span className="hidden sm:inline">•</span>
											<span className="hidden sm:inline truncate">
												{shift.shiftType.location}
											</span>
										</div>
									</div>
									<Badge
										variant="outline"
										className="text-xs px-1.5 py-0.5 shrink-0"
									>
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
