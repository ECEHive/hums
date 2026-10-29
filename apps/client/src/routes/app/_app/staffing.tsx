import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Clock, RefreshCw, UserCheck } from "lucide-react";
import {
	Page,
	PageDescription,
	PageHeader,
	PageTitle,
} from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/app/_app/staffing")({
	component: StaffingPage,
});

type StaffingData = Awaited<
	ReturnType<typeof trpc.staffing.currentStaffing.query>
>;
type ShiftGroup = StaffingData["currentShiftGroups"][number];
type AssignedUser = ShiftGroup["timeSlots"][number]["assignedUsers"][number];

const statusLabels: Record<AssignedUser["status"], string> = {
	present: "Present",
	late: "Late",
	missing: "Missing",
	"not-started": "Not started",
};

function StaffingPage() {
	const { data, isPending, isError, isFetching, dataUpdatedAt, refetch } =
		useQuery({
			queryKey: ["staffing", "currentStaffing"],
			queryFn: () => trpc.staffing.currentStaffing.query({}),
			refetchInterval: 5_000,
			staleTime: 3_000,
		});
	const totalSlots =
		data?.currentShiftGroups.reduce(
			(total, group) =>
				total + group.timeSlots.reduce((sum, slot) => sum + slot.totalSlots, 0),
			0,
		) ?? 0;
	const missingSlots =
		data?.currentShiftGroups.reduce(
			(total, group) =>
				total +
				group.timeSlots.reduce(
					(sum, slot) =>
						sum +
						slot.emptySlots +
						slot.assignedUsers.filter((user) => user.status === "missing")
							.length,
					0,
				),
			0,
		) ?? 0;

	return (
		<Page>
			<PageHeader>
				<div className="space-y-1">
					<PageTitle>Staffing</PageTitle>
					<PageDescription>
						See who is staffing now and which shifts are coming up.
					</PageDescription>
				</div>
				<div className="flex items-center gap-2 text-xs text-muted-foreground">
					<RefreshCw
						aria-hidden="true"
						className={`h-3 w-3 ${isFetching ? "animate-spin" : ""}`}
					/>
					<span>
						{isFetching
							? "Updating..."
							: dataUpdatedAt
								? `Updated ${formatTime(new Date(dataUpdatedAt))}`
								: "Waiting for staffing data"}
					</span>
				</div>
			</PageHeader>
			{isError && (
				<Card role="alert">
					<CardHeader>
						<CardTitle className="flex items-center gap-2 text-base">
							<AlertTriangle className="h-4 w-4 text-destructive" />
							Unable to update staffing
						</CardTitle>
						<CardDescription>
							{data
								? "Showing the last available staffing information. Live updates will resume automatically."
								: "Staffing information could not be loaded. Please try again."}
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Button
							variant="outline"
							size="sm"
							onClick={() => void refetch()}
							disabled={isFetching}
						>
							Try again
						</Button>
					</CardContent>
				</Card>
			)}
			{(isPending || data) && (
				<Card>
					<CardHeader>
						<div className="flex flex-wrap items-center justify-between gap-3">
							<div className="space-y-1">
								<CardTitle className="flex items-center gap-2 text-base md:text-lg">
									<UserCheck className="h-5 w-5" />
									Current Shifts
								</CardTitle>
								<CardDescription>
									Active shift occurrences right now
								</CardDescription>
							</div>
							{data && (
								<div className="flex flex-wrap gap-2">
									<Badge variant="secondary">
										{totalSlots} slot{totalSlots === 1 ? "" : "s"}
									</Badge>
									{missingSlots > 0 && (
										<Badge variant="destructive">{missingSlots} missing</Badge>
									)}
								</div>
							)}
						</div>
					</CardHeader>
					<CardContent>
						{isPending ? (
							<div className="space-y-4">
								<span className="sr-only">Loading staffing</span>
								<Skeleton className="h-5 w-40" />
								<Skeleton className="h-24 w-full" />
								<Skeleton className="h-24 w-full" />
							</div>
						) : (
							data &&
							(data.currentShiftGroups.length ? (
								<ShiftGroups groups={data.currentShiftGroups} />
							) : (
								<p className="py-8 text-center text-sm text-muted-foreground">
									No active shifts right now
								</p>
							))
						)}
					</CardContent>
				</Card>
			)}
			{data && data.upcomingShiftGroups.length > 0 && (
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2 text-base md:text-lg">
							<Clock className="h-5 w-5" />
							Upcoming Shifts
						</CardTitle>
						<CardDescription>
							Shifts starting in the next 30 minutes
						</CardDescription>
					</CardHeader>
					<CardContent>
						<ShiftGroups groups={data.upcomingShiftGroups} />
					</CardContent>
				</Card>
			)}
		</Page>
	);
}

function ShiftGroups({ groups }: { groups: ShiftGroup[] }) {
	return (
		<div className="space-y-6">
			{groups.map((group) => (
				<div key={group.shiftType.id} className="space-y-3">
					<div className="flex flex-wrap items-baseline gap-2">
						<h2 className="text-sm font-semibold md:text-base">
							{group.shiftType.name}
						</h2>
						<span className="text-xs text-muted-foreground">
							{group.shiftType.location}
						</span>
					</div>
					<div
						className={
							group.timeSlots.length > 1
								? "grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
								: "space-y-3"
						}
					>
						{group.timeSlots.map((slot) => (
							<div
								key={`${slot.startTime}-${slot.endTime}`}
								className="space-y-3 rounded-lg border bg-muted/30 p-3"
							>
								<div className="flex flex-wrap items-center justify-between gap-2">
									<span className="text-xs font-medium">
										{formatTime(slot.startTime)} – {formatTime(slot.endTime)}
									</span>
									{slot.assignedUsers.length === 0 && slot.emptySlots > 0 && (
										<Badge variant="outline">Unstaffed</Badge>
									)}
								</div>
								<div className="flex flex-wrap gap-2">
									{slot.assignedUsers.map((user) => (
										<Badge
											key={user.id}
											variant={
												user.status === "missing"
													? "destructive"
													: user.status === "not-started"
														? "outline"
														: "secondary"
											}
											className="max-w-full whitespace-normal break-words"
										>
											{user.name} · {statusLabels[user.status]}
										</Badge>
									))}
									{slot.emptySlots > 0 && (
										<Badge variant="outline" className="border-dashed">
											{slot.emptySlots} empty slot
											{slot.emptySlots === 1 ? "" : "s"}
										</Badge>
									)}
								</div>
							</div>
						))}
					</div>
				</div>
			))}
		</div>
	);
}

function formatTime(date: Date | string): string {
	return new Date(date).toLocaleTimeString([], {
		hour: "numeric",
		minute: "2-digit",
	});
}
