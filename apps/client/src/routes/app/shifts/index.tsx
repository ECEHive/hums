import { createFileRoute, Link } from "@tanstack/react-router";
import {
	CalendarCheckIcon,
	ClockIcon,
	ShieldCheckIcon,
	UserPlusIcon,
} from "lucide-react";
import { useCurrentUser } from "@/auth/AuthProvider";
import { PeriodNotSelected } from "@/components/errors/period-not-selected";
import { RequireShiftAccess } from "@/components/guards/require-shift-access";
import { Page, PageContent, PageHeader, PageTitle } from "@/components/layout";
import { usePeriod } from "@/components/providers/period-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useShiftAccess } from "@/hooks/use-shift-access";
import { checkPermissions, type RequiredPermissions } from "@/lib/permissions";

export const Route = createFileRoute("/app/shifts/")({
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
	const currentUser = useCurrentUser();
	const canManageUsers = checkPermissions(currentUser, [
		"shift_schedules.manipulate",
	]);

	if (periodId === null) {
		return <PeriodNotSelected />;
	}

	const showQuickActions = canAccessShifts;

	return (
		<Page>
			<PageHeader>
				<PageTitle>Shifts</PageTitle>
			</PageHeader>

			<PageContent>
				{/* Quick Actions */}
				{showQuickActions && (
					<Card>
						<CardHeader>
							<CardTitle>Quick Actions</CardTitle>
						</CardHeader>
						<CardContent className="flex flex-col gap-2">
							<Link to="/app/shifts/scheduling">
								<Button variant="outline" className="w-full justify-start">
									<UserPlusIcon className="mr-2 h-4 w-4" />
									Register for Shifts
								</Button>
							</Link>
							<Link to="/app/shifts/my-shifts">
								<Button variant="outline" className="w-full justify-start">
									<CalendarCheckIcon className="mr-2 h-4 w-4" />
									View My Shifts
								</Button>
							</Link>
							<Link to="/app/shifts/attendance">
								<Button variant="outline" className="w-full justify-start">
									<ClockIcon className="mr-2 h-4 w-4" />
									View Attendance History
								</Button>
							</Link>
							{canManageUsers ? (
								<Link to="/app/shifts/manage-users">
									<Button variant="outline" className="w-full justify-start">
										<ShieldCheckIcon className="mr-2 h-4 w-4" />
										Manage User Shifts
									</Button>
								</Link>
							) : null}
						</CardContent>
					</Card>
				)}
			</PageContent>
		</Page>
	);
}
