import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
	CalendarCheckIcon,
	CalendarClockIcon,
	CalendarXIcon,
	ClockIcon,
} from "lucide-react";
import { columns } from "@/components/attendance/columns";
import { PeriodNotSelected } from "@/components/errors/period-not-selected";
import { RequireShiftAccess } from "@/components/guards/require-shift-access";
import {
	Page,
	PageContent,
	PageHeader,
	PageTitle,
	TableContainer,
	TableToolbar,
} from "@/components/layout";
import { usePeriod } from "@/components/providers/period-provider";
import { DataTable, TablePaginationFooter } from "@/components/shared";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { usePaginationInfo } from "@/hooks/use-pagination-info";
import { useTableState } from "@/hooks/use-table-state";
import type { RequiredPermissions } from "@/lib/permissions";

export const Route = createFileRoute("/app/shifts/attendance")({
	component: () => (
		<RequireShiftAccess>
			<AttendancePage />
		</RequireShiftAccess>
	),
});

export const permissions = [] as RequiredPermissions;

function AttendancePage() {
	const { period: selectedPeriodId } = usePeriod();
	const { page, setPage, pageSize, setPageSize, offset, resetToFirstPage } =
		useTableState({ initialPageSize: 20 });
	const limit = pageSize;

	const { data: attendanceData, isLoading: attendanceLoading } = useQuery({
		queryKey: ["myAttendance", selectedPeriodId, page, limit],
		queryFn: async () => {
			if (!selectedPeriodId) return null;
			return trpc.shiftAttendances.listMy.query({
				periodId: selectedPeriodId,
				limit,
				offset,
			});
		},
		enabled: !!selectedPeriodId,
	});

	const { data: statsData } = useQuery({
		queryKey: ["myAttendanceStats", selectedPeriodId],
		queryFn: async () => {
			if (!selectedPeriodId) return null;
			return trpc.shiftAttendances.myStats.query({
				periodId: selectedPeriodId,
			});
		},
		enabled: !!selectedPeriodId,
	});

	const attendances = attendanceData?.attendances ?? [];
	const total = attendanceData?.total ?? 0;

	const { totalPages } = usePaginationInfo({
		total,
		pageSize,
		offset,
		currentCount: attendances.length,
	});

	if (selectedPeriodId === null) {
		return <PeriodNotSelected />;
	}

	return (
		<Page>
			<PageHeader>
				<PageTitle>Shift Attendance</PageTitle>
			</PageHeader>

			<PageContent>
				{/* Stats Cards */}
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
								{statsData?.totalShifts ?? 0}
							</div>
							<p className="text-xs text-muted-foreground">
								{statsData?.upcomingShiftsCount ?? 0} upcoming makeups
							</p>
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">
								Attendance Rate
							</CardTitle>
							<ClockIcon className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold">
								{statsData?.attendanceRate ?? 0}%
							</div>
							<p className="text-xs text-muted-foreground">
								of eligible shifts attended
							</p>
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">
								Time on Shift
							</CardTitle>
							<CalendarClockIcon className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold">
								{statsData?.timeOnShiftPercentage ?? 0}%
							</div>
							<p className="text-xs text-muted-foreground">
								{statsData?.totalHoursWorked ?? 0}h logged
							</p>
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">
								Dropped Shifts
							</CardTitle>
							<CalendarXIcon className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<div className="flex items-baseline justify-between gap-4">
								<div>
									<div className="text-2xl font-bold">
										{statsData?.droppedCount ?? 0}
									</div>
									<p className="text-xs text-muted-foreground">
										without makeup
									</p>
								</div>
								<div>
									<div className="text-2xl font-bold">
										{statsData?.droppedMakeupCount ?? 0}
									</div>
									<p className="text-xs text-muted-foreground">with makeup</p>
								</div>
							</div>
						</CardContent>
					</Card>
				</div>

				{/* Attendance Table */}
				<Card>
					<CardHeader>
						<div>
							<CardTitle>Attendance Records</CardTitle>
							<CardDescription>
								View your shift attendance records for this period
							</CardDescription>
						</div>
					</CardHeader>
					<CardContent>
						<TableContainer>
							<TableToolbar>
								<div />
							</TableToolbar>

							<DataTable
								columns={columns}
								data={attendances}
								isLoading={attendanceLoading}
								emptyMessage="No attendance records found"
								emptyDescription="Your attendance records will appear here"
							/>

							{total > 0 && (
								<TablePaginationFooter
									page={page}
									totalPages={totalPages}
									onPageChange={setPage}
									offset={offset}
									currentCount={attendances.length}
									total={total}
									itemName="attendance records"
									pageSize={pageSize}
									onPageSizeChange={(size) => {
										setPageSize(size);
										resetToFirstPage();
									}}
									pageSizeOptions={[10, 20, 50, 100]}
								/>
							)}
						</TableContainer>
					</CardContent>
				</Card>
			</PageContent>
		</Page>
	);
}
