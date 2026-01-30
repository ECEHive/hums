import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
	AlertTriangle,
	Clock,
	RefreshCw,
	User,
	UserCheck,
	UserMinus,
	UserX,
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

type UserStatus = "present" | "late" | "missing" | "not-started";

interface AssignedUser {
	id: number;
	name: string;
	status: UserStatus;
}

// A time slot groups all users from overlapping occurrences
interface TimeSlot {
	startTime: Date;
	endTime: Date;
	totalSlots: number;
	emptySlots: number;
	assignedUsers: AssignedUser[];
}

interface ShiftTypeGroup {
	shiftType: {
		id: number;
		name: string;
		location: string;
	};
	timeSlots: TimeSlot[];
}

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

	// Count totals for summary
	// Total slots = sum of all totalSlots across all time slots
	const totalCurrentSlots =
		data?.currentShiftGroups.reduce(
			(sum, g) => sum + g.timeSlots.reduce((s, t) => s + t.totalSlots, 0),
			0,
		) ?? 0;
	// Missing = users marked as missing + empty slots
	const totalMissing =
		data?.currentShiftGroups.reduce(
			(sum, g) =>
				sum +
				g.timeSlots.reduce(
					(s, t) =>
						s +
						t.assignedUsers.filter((u) => u.status === "missing").length +
						t.emptySlots,
					0,
				),
			0,
		) ?? 0;

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

			{/* Current Shifts Section */}
			<Card>
				<CardHeader className="pb-2 md:pb-4">
					<div className="flex items-center justify-between">
						<div className="space-y-1">
							<CardTitle className="flex items-center gap-2 text-base md:text-lg">
								<UserCheck className="h-4 w-4 md:h-5 md:w-5" />
								Current Shifts
							</CardTitle>
							<CardDescription className="text-xs md:text-sm">
								Active shift occurrences right now
							</CardDescription>
						</div>
						{!isLoading && data && (
							<div className="flex items-center gap-2">
								<Badge
									variant="secondary"
									className="text-sm md:text-base font-semibold px-2.5 py-1 md:px-3 md:py-1.5"
								>
									{totalCurrentSlots} slot
									{totalCurrentSlots !== 1 ? "s" : ""}
								</Badge>
								{totalMissing > 0 && (
									<Badge
										variant="destructive"
										className="text-sm md:text-base font-semibold px-2.5 py-1 md:px-3 md:py-1.5"
									>
										{totalMissing} missing
									</Badge>
								)}
							</div>
						)}
					</div>
				</CardHeader>
				<CardContent>
					{isLoading || deviceLoading ? (
						<div className="space-y-4">
							{[1, 2].map((i) => (
								<div key={i} className="space-y-2">
									<Skeleton className="h-5 w-40" />
									<Skeleton className="h-20 w-full" />
								</div>
							))}
						</div>
					) : !data || data.currentShiftGroups.length === 0 ? (
						<p className="text-muted-foreground text-center py-6 md:py-8 text-sm">
							No active shifts right now
						</p>
					) : (
						<div className="space-y-6">
							{data.currentShiftGroups.map((group) => (
								<ShiftTypeGroupCard
									key={group.shiftType.id}
									group={group}
									variant="current"
								/>
							))}
						</div>
					)}
				</CardContent>
			</Card>

			{/* Upcoming Shifts Section */}
			{!isLoading && data && data.upcomingShiftGroups.length > 0 && (
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
						<div className="space-y-6">
							{data.upcomingShiftGroups.map((group) => (
								<ShiftTypeGroupCard
									key={group.shiftType.id}
									group={group}
									variant="upcoming"
								/>
							))}
						</div>
					</CardContent>
				</Card>
			)}
		</div>
	);
}

interface ShiftTypeGroupCardProps {
	group: ShiftTypeGroup;
	variant: "current" | "upcoming";
}

function ShiftTypeGroupCard({ group, variant }: ShiftTypeGroupCardProps) {
	const isSingleSlot = group.timeSlots.length === 1;

	return (
		<div className="space-y-3">
			{/* Shift Type Header */}
			<div className="flex items-center gap-2">
				<h3 className="font-semibold text-sm md:text-base">
					{group.shiftType.name}
				</h3>
				<span className="text-xs text-muted-foreground">
					{group.shiftType.location}
				</span>
			</div>

			{/* Time Slots */}
			<div
				className={
					isSingleSlot ? "" : "grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
				}
			>
				{group.timeSlots.map((timeSlot) => (
					<TimeSlotCard
						key={`${new Date(timeSlot.startTime).getTime()}-${new Date(timeSlot.endTime).getTime()}`}
						timeSlot={timeSlot}
						variant={variant}
						layout={isSingleSlot ? "horizontal" : "vertical"}
					/>
				))}
			</div>
		</div>
	);
}

interface TimeSlotCardProps {
	timeSlot: TimeSlot;
	variant: "current" | "upcoming";
	layout: "horizontal" | "vertical";
}

function TimeSlotCard({ timeSlot, variant, layout }: TimeSlotCardProps) {
	const hasAssignedUsers = timeSlot.assignedUsers.length > 0;
	const hasEmptySlots = timeSlot.emptySlots > 0;
	const isCompletelyEmpty = !hasAssignedUsers && hasEmptySlots;

	return (
		<div
			className={`rounded-lg border p-3 ${
				variant === "current" && isCompletelyEmpty
					? "border-amber-500/50 bg-amber-50 dark:bg-amber-950/20"
					: "bg-muted/30"
			}`}
		>
			{/* Time display */}
			<div className="flex items-center justify-between mb-2">
				<span className="text-xs font-medium">
					{formatTimeRange(timeSlot.startTime, timeSlot.endTime)}
				</span>
				{variant === "upcoming" && (
					<Badge variant="outline" className="text-xs">
						Starts {formatTime(timeSlot.startTime)}
					</Badge>
				)}
				{variant === "current" && isCompletelyEmpty && (
					<Badge
						variant="outline"
						className="text-xs text-amber-600 border-amber-500 dark:text-amber-400"
					>
						Unstaffed
					</Badge>
				)}
			</div>

			{/* Assigned Users and Empty Slots */}
			<div className="flex flex-wrap gap-2">
				{timeSlot.assignedUsers.map((user) => (
					<UserStatusRow
						key={user.id}
						user={user}
						compact={layout === "horizontal"}
					/>
				))}
				{/* Show empty slot indicators */}
				{hasEmptySlots &&
					Array.from({ length: timeSlot.emptySlots }).map((_, index) => (
						<EmptySlotIndicator
							key={`empty-${index}`}
							compact={layout === "horizontal"}
						/>
					))}
			</div>
		</div>
	);
}

interface EmptySlotIndicatorProps {
	compact?: boolean;
}

function EmptySlotIndicator({ compact = false }: EmptySlotIndicatorProps) {
	return (
		<div
			className={`inline-flex items-center gap-1.5 rounded-full bg-muted/50 border border-dashed border-muted-foreground/30 ${
				compact ? "px-2 py-1" : "px-2.5 py-1.5"
			}`}
		>
			<UserMinus
				className={`text-muted-foreground ${compact ? "h-3.5 w-3.5" : "h-4 w-4"}`}
			/>
			<span
				className={`text-muted-foreground ${compact ? "text-xs" : "text-sm"}`}
			>
				Empty
			</span>
		</div>
	);
}

interface UserStatusRowProps {
	user: AssignedUser;
	compact?: boolean;
}

function UserStatusRow({ user, compact = false }: UserStatusRowProps) {
	const getStatusConfig = (status: UserStatus) => {
		switch (status) {
			case "present":
				return {
					icon: UserCheck,
					iconClassName: "text-green-600 dark:text-green-400",
					bgClassName: "bg-green-100 dark:bg-green-900/30",
					textClassName: "",
				};
			case "late":
				return {
					icon: UserCheck,
					iconClassName: "text-orange-600 dark:text-orange-400",
					bgClassName: "bg-orange-100 dark:bg-orange-900/30",
					textClassName: "",
				};
			case "missing":
				return {
					icon: UserX,
					iconClassName: "text-destructive",
					bgClassName: "bg-muted/50",
					textClassName: "text-destructive",
				};
			case "not-started":
				return {
					icon: User,
					iconClassName: "text-muted-foreground",
					bgClassName: "bg-muted/50",
					textClassName: "",
				};
		}
	};

	const config = getStatusConfig(user.status);
	const Icon = config.icon;

	return (
		<div
			className={`inline-flex items-center gap-1.5 rounded-full ${config.bgClassName} ${
				compact ? "px-2 py-1" : "px-2.5 py-1.5"
			}`}
		>
			<div
				className={`rounded-full flex items-center justify-center shrink-0 ${config.iconClassName} ${
					compact ? "h-4 w-4" : "h-5 w-5"
				}`}
			>
				<Icon className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} />
			</div>
			<span
				className={`font-medium ${config.textClassName} ${
					compact ? "text-xs" : "text-sm"
				}`}
			>
				{user.name}
			</span>
		</div>
	);
}

function formatTime(date: Date | string): string {
	const d = new Date(date);
	return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatTimeRange(start: Date | string, end: Date | string): string {
	return `${formatTime(start)} - ${formatTime(end)}`;
}

function formatRelativeTime(timestamp: number): string {
	const seconds = Math.floor((Date.now() - timestamp) / 1000);
	if (seconds < 5) return "just now";
	if (seconds < 60) return `${seconds}s ago`;
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m ago`;
	return formatTime(new Date(timestamp));
}
