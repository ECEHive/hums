import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	CalendarCheckIcon,
	CalendarClockIcon,
	TrendingUpIcon,
} from "lucide-react";
import { RequirePermissions, useCurrentUser } from "@/auth/AuthProvider";
import { MissingPermissions } from "@/components/missing-permissions";
import { PeriodNotSelected } from "@/components/period-not-selected";
import { usePeriod } from "@/components/period-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RequiredPermissions } from "@/lib/permissions";
import { checkPermissions } from "@/lib/permissions";

export const Route = createFileRoute("/shifts/")({
	component: () =>
		RequirePermissions({
			permissions,
			children: <ShiftsIndex />,
			forbiddenFallback: <MissingPermissions />,
		}),
});

export const permissions = {
	any: [
		"periods.list",
		"shift_types.list",
		"shift_schedules.list",
		"shift_schedules.register",
		"shift_schedules.unregister",
	],
} as RequiredPermissions;

function ShiftsIndex() {
	const { period: periodId } = usePeriod();
	const user = useCurrentUser();

	const { data: attendanceStats } = useQuery({
		queryKey: ["myAttendanceStats", periodId],
		queryFn: async () => {
			if (!periodId) return null;
			return trpc.shiftAttendances.myStats.query({ periodId });
		},
		enabled: !!periodId,
	});

	if (periodId === null) {
		return <PeriodNotSelected />;
	}

	const hasShiftPermissions = checkPermissions(user, {
		any: ["shift_schedules.register", "shift_schedules.unregister"],
	});

	return (
		<div className="container p-4 space-y-6">
			<div className="flex items-center justify-between">
				<h1 className="text-2xl font-bold">Shifts</h1>
			</div>

			{hasShiftPermissions &&
				attendanceStats &&
				attendanceStats.totalShifts > 0 && (
					<>
						<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
							<Card>
								<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
									<CardTitle className="text-sm font-medium">
										Total Shifts
									</CardTitle>
									<CalendarCheckIcon className="h-4 w-4 text-muted-foreground" />
								</CardHeader>
								<CardContent>
									<div className="text-2xl font-bold">
										{attendanceStats.totalShifts}
									</div>
									<p className="text-xs text-muted-foreground">
										shifts assigned this period
									</p>
								</CardContent>
							</Card>

							<Card>
								<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
									<CardTitle className="text-sm font-medium">
										Attendance Rate
									</CardTitle>
									<TrendingUpIcon className="h-4 w-4 text-muted-foreground" />
								</CardHeader>
								<CardContent>
									<div className="text-2xl font-bold">
										{attendanceStats.attendanceRate}%
									</div>
									<p className="text-xs text-muted-foreground">
										{attendanceStats.presentCount} of{" "}
										{attendanceStats.totalShifts} present
									</p>
								</CardContent>
							</Card>

							<Card>
								<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
									<CardTitle className="text-sm font-medium">
										Hours Worked
									</CardTitle>
									<CalendarClockIcon className="h-4 w-4 text-muted-foreground" />
								</CardHeader>
								<CardContent>
									<div className="text-2xl font-bold">
										{attendanceStats.totalHoursWorked}
									</div>
									<p className="text-xs text-muted-foreground">
										hours logged this period
									</p>
								</CardContent>
							</Card>

							<Card>
								<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
									<CardTitle className="text-sm font-medium">
										Upcoming Shifts
									</CardTitle>
									<CalendarCheckIcon className="h-4 w-4 text-muted-foreground" />
								</CardHeader>
								<CardContent>
									<div className="text-2xl font-bold">
										{attendanceStats.upcomingShiftsCount}
									</div>
									<Link to="/shifts/my-shifts">
										<p className="text-xs text-primary hover:underline">
											View all shifts →
										</p>
									</Link>
								</CardContent>
							</Card>
						</div>

						<Card>
							<CardHeader>
								<CardTitle>Quick Actions</CardTitle>
							</CardHeader>
							<CardContent className="flex flex-col gap-2">
								<Link to="/shifts/my-shifts">
									<Button variant="outline" className="w-full justify-start">
										View My Shifts
									</Button>
								</Link>
								<Link to="/shifts/attendance">
									<Button variant="outline" className="w-full justify-start">
										View Attendance History
									</Button>
								</Link>
							</CardContent>
						</Card>
					</>
				)}
		</div>
	);
}
