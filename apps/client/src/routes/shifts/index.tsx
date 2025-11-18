import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarCheckIcon, ClockIcon, UserPlusIcon } from "lucide-react";
import { PeriodNotSelected } from "@/components/period-not-selected";
import { usePeriod } from "@/components/period-provider";
import { RequireShiftAccess } from "@/components/require-shift-access";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useShiftAccess } from "@/hooks/use-shift-access";
import type { RequiredPermissions } from "@/lib/permissions";

export const Route = createFileRoute("/shifts/")({
	component: () => (
		<RequireShiftAccess>
			<ShiftsIndex />
		</RequireShiftAccess>
	),
});

export const permissions = {
	any: ["periods.list", "shift_types.list", "shift_schedules.list"],
} as RequiredPermissions;

function ShiftsIndex() {
	const { period: periodId } = usePeriod();
	const { canAccessShifts } = useShiftAccess();

	if (periodId === null) {
		return <PeriodNotSelected />;
	}

	const showQuickActions = canAccessShifts;

	return (
		<div className="container p-4 space-y-4">
			<div className="flex items-center justify-between">
				<h1 className="text-2xl font-bold">Shifts</h1>
			</div>

			{/* Quick Actions */}
			{showQuickActions && (
				<Card>
					<CardHeader>
						<CardTitle>Quick Actions</CardTitle>
					</CardHeader>
					<CardContent className="flex flex-col gap-2">
						<Link to="/shifts/scheduling">
							<Button variant="outline" className="w-full justify-start">
								<UserPlusIcon className="mr-2 h-4 w-4" />
								Register for Shifts
							</Button>
						</Link>
						<Link to="/shifts/my-shifts">
							<Button variant="outline" className="w-full justify-start">
								<CalendarCheckIcon className="mr-2 h-4 w-4" />
								View My Shifts
							</Button>
						</Link>
						<Link to="/shifts/attendance">
							<Button variant="outline" className="w-full justify-start">
								<ClockIcon className="mr-2 h-4 w-4" />
								View Attendance History
							</Button>
						</Link>
					</CardContent>
				</Card>
			)}
		</div>
	);
}
