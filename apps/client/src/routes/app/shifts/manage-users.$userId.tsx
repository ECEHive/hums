import { trpc } from "@ecehive/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeftIcon, UsersIcon } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";
import { RequirePermissions, useCurrentUser } from "@/auth/AuthProvider";
import { PeriodNotSelected } from "@/components/errors/period-not-selected";
import { MissingPermissions } from "@/components/guards/missing-permissions";
import { Page, PageContent, PageHeader, PageTitle } from "@/components/layout";
import { usePeriod } from "@/components/providers/period-provider";
import {
	AssignedSchedulesSection,
	type AttendanceData,
	AttendanceSection,
	type ScheduleManagementData,
	SchedulesSection,
	SummaryStat,
	type UpcomingData,
	UpcomingSection,
} from "@/components/shift-management/user-shift-sections";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useManageUsersMemory } from "@/hooks/use-manage-users-memory";
import { checkPermissions, type RequiredPermissions } from "@/lib/permissions";

export const Route = createFileRoute("/app/shifts/manage-users/$userId")({
	component: () =>
		RequirePermissions({
			permissions,
			children: <ManageUserDetailPage />,
			forbiddenFallback: <MissingPermissions />,
		}),
});

export const permissions = [
	"shift_schedules.manipulate",
] as RequiredPermissions;

const SCHEDULES_QUERY_KEY = ["manage-user-schedules"] as const;
const UPCOMING_QUERY_KEY = ["manage-user-upcoming"] as const;
const ATTENDANCE_QUERY_KEY = ["manage-user-attendance"] as const;

function getErrorMessage(error: unknown) {
	if (error instanceof Error) return error.message;
	if (typeof error === "string") return error;
	return "Something went wrong";
}

function ManageUserDetailPage() {
	const { userId } = Route.useParams();
	const userIdNum = Number(userId);
	const { period: selectedPeriodId } = usePeriod();
	const queryClient = useQueryClient();
	const currentUser = useCurrentUser();
	const canManageAssignments = checkPermissions(currentUser, permissions);
	const canViewUpcoming = checkPermissions(currentUser, permissions);
	const canViewAttendance = checkPermissions(currentUser, permissions);

	// Remember this user visit for sidebar navigation
	useManageUsersMemory(userId);

	// Fetch user info
	const userQuery = useQuery({
		queryKey: ["user-info", userIdNum],
		queryFn: async () => {
			return trpc.users.get.query({ id: userIdNum });
		},
		enabled: Boolean(userIdNum),
	});

	const schedulesQuery = useQuery<ScheduleManagementData | null, Error>({
		queryKey: [...SCHEDULES_QUERY_KEY, selectedPeriodId, userIdNum],
		queryFn: async () => {
			if (!selectedPeriodId) return null;
			return trpc.shiftSchedules.listForUserManagement.query({
				periodId: selectedPeriodId,
				userId: userIdNum,
			});
		},
		enabled: Boolean(selectedPeriodId && userIdNum),
	});

	const upcomingQuery = useQuery<UpcomingData | null, Error>({
		queryKey: [...UPCOMING_QUERY_KEY, selectedPeriodId, userIdNum],
		queryFn: async () => {
			if (!selectedPeriodId) return null;
			return trpc.shiftOccurrences.listForUser.query({
				periodId: selectedPeriodId,
				userId: userIdNum,
				limit: 50,
			});
		},
		enabled: Boolean(selectedPeriodId && userIdNum),
	});

	const attendanceQuery = useQuery<AttendanceData | null, Error>({
		queryKey: [...ATTENDANCE_QUERY_KEY, selectedPeriodId, userIdNum],
		queryFn: async () => {
			if (!selectedPeriodId) return null;
			return trpc.shiftAttendances.listForUser.query({
				periodId: selectedPeriodId,
				userId: userIdNum,
				limit: 25,
			});
		},
		enabled: Boolean(selectedPeriodId && userIdNum),
	});

	const invalidateManagementData = async () => {
		await Promise.all([
			queryClient.invalidateQueries({ queryKey: SCHEDULES_QUERY_KEY }),
			queryClient.invalidateQueries({ queryKey: UPCOMING_QUERY_KEY }),
			queryClient.invalidateQueries({ queryKey: ATTENDANCE_QUERY_KEY }),
		]);
	};

	const assignMutation = useMutation<void, Error, number>({
		mutationFn: async (shiftScheduleId: number) => {
			await trpc.shiftSchedules.forceRegister.mutate({
				shiftScheduleId,
				userId: userIdNum,
			});
		},
		onSuccess: async () => {
			await invalidateManagementData();
			toast.success("User assigned to shift");
		},
		onError: (error) => toast.error(getErrorMessage(error)),
	});

	const unassignMutation = useMutation<void, Error, number>({
		mutationFn: async (shiftScheduleId: number) => {
			await trpc.shiftSchedules.forceUnregister.mutate({
				shiftScheduleId,
				userId: userIdNum,
			});
		},
		onSuccess: async () => {
			await invalidateManagementData();
			toast.success("User removed from shift");
		},
		onError: (error) => toast.error(getErrorMessage(error)),
	});

	const assignedCount = useMemo(() => {
		return (
			schedulesQuery.data?.schedules.filter((schedule) => schedule.isRegistered)
				.length ?? 0
		);
	}, [schedulesQuery.data]);

	const upcomingCount = upcomingQuery.data?.total ?? 0;
	const attendanceCount = attendanceQuery.data?.total ?? 0;
	const periodLabel =
		schedulesQuery.data?.period?.name ?? `Period ${selectedPeriodId}`;

	if (selectedPeriodId === null) {
		return <PeriodNotSelected />;
	}

	const user = userQuery.data?.user;
	const userName = user?.name ?? user?.username ?? `User #${userIdNum}`;
	const isLoading = userQuery.isLoading || schedulesQuery.isLoading;

	return (
		<Page>
			<PageHeader>
				<div>
					<PageTitle className="flex items-center gap-2">
						<Link to="/app/shifts/manage-users">
							<Button variant="ghost">
								<ArrowLeftIcon className="h-4 w-4" />
							</Button>
						</Link>
						Manage Shifts: {userName}
					</PageTitle>
				</div>
			</PageHeader>

			<PageContent>
				{isLoading ? (
					<div className="flex items-center justify-center py-16">
						<Spinner className="h-8 w-8" />
					</div>
				) : (
					<>
						{/* User Summary Card */}
						<Card>
							<CardHeader>
								<CardTitle>User Summary</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="grid gap-4 md:grid-cols-2">
									<div>
										<p className="text-sm font-medium mb-2">User</p>
										<div className="flex h-10 items-center rounded-md border px-3 text-sm">
											{userName}
											{user?.email && (
												<span className="text-muted-foreground ml-2">
													({user.email})
												</span>
											)}
										</div>
									</div>
									<div>
										<p className="text-sm font-medium mb-2">Period</p>
										<div className="flex h-10 items-center rounded-md border px-3 text-sm">
											{periodLabel}
										</div>
									</div>
								</div>
								<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
									<SummaryStat label="Assigned shifts" value={assignedCount} />
									<SummaryStat label="Upcoming" value={upcomingCount} />
									<SummaryStat
										label="Attendance records"
										value={attendanceCount}
									/>
								</div>
							</CardContent>
						</Card>

						{/* Shift Assignments Card */}
						{canManageAssignments && (
							<Card>
								<CardHeader>
									<CardTitle className="flex items-center gap-2">
										<UsersIcon className="h-5 w-5" /> Shift assignments
									</CardTitle>
								</CardHeader>
								<CardContent>
									<Tabs defaultValue="assign" className="space-y-4">
										<TabsList>
											<TabsTrigger value="assign">Find & assign</TabsTrigger>
											<TabsTrigger value="current">
												Current assignments
											</TabsTrigger>
										</TabsList>
										<TabsContent value="assign" className="space-y-4">
											<SchedulesSection
												query={schedulesQuery}
												assignMutation={assignMutation}
												unassignMutation={unassignMutation}
												activeUserId={userIdNum}
											/>
										</TabsContent>
										<TabsContent value="current" className="space-y-4">
											<AssignedSchedulesSection
												query={schedulesQuery}
												unassignMutation={unassignMutation}
												activeUserId={userIdNum}
											/>
										</TabsContent>
									</Tabs>
								</CardContent>
							</Card>
						)}

						{/* Upcoming Shifts and Attendance History */}
						<div className="grid gap-4 lg:grid-cols-2">
							{canViewUpcoming && (
								<Card>
									<CardHeader>
										<CardTitle>Upcoming shifts</CardTitle>
									</CardHeader>
									<CardContent>
										<UpcomingSection
											query={upcomingQuery}
											activeUserId={userIdNum}
										/>
									</CardContent>
								</Card>
							)}
							{canViewAttendance && (
								<Card>
									<CardHeader>
										<CardTitle>Attendance history</CardTitle>
									</CardHeader>
									<CardContent>
										<AttendanceSection
											query={attendanceQuery}
											activeUserId={userIdNum}
										/>
									</CardContent>
								</Card>
							)}
						</div>

						{!canManageAssignments &&
							!canViewUpcoming &&
							!canViewAttendance && (
								<div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
									You do not have permission to view staffing data for this
									user.
								</div>
							)}
					</>
				)}
			</PageContent>
		</Page>
	);
}
