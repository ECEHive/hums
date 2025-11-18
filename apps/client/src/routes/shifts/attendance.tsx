import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
	CalendarCheckIcon,
	CalendarClockIcon,
	CalendarXIcon,
	ChevronDownIcon,
	ClockIcon,
} from "lucide-react";
import React from "react";
import { RequirePermissions } from "@/auth";
import { MissingPermissions } from "@/components/missing-permissions";
import { PeriodNotSelected } from "@/components/period-not-selected";
import { usePeriod } from "@/components/period-provider";
import { TablePagination } from "@/components/table-pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { RequiredPermissions } from "@/lib/permissions";
import { formatInAppTimezone, formatTimeRange } from "@/lib/timezone";

export const Route = createFileRoute("/shifts/attendance")({
	component: () =>
		RequirePermissions({
			permissions,
			children: <AttendancePage />,
			forbiddenFallback: <MissingPermissions />,
		}),
});

export const permissions = {
	any: ["shift_schedules.register", "shift_schedules.unregister"],
} as RequiredPermissions;

function AttendancePage() {
	const { period: selectedPeriodId } = usePeriod();
	const [page, setPage] = React.useState(1);
	const [pageSize, setPageSize] = React.useState(20);
	const limit = pageSize;
	const offset = (page - 1) * limit;

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
	const totalPages = Math.ceil(total / pageSize) || 1;

	if (selectedPeriodId === null) {
		return <PeriodNotSelected />;
	}

	const formatDate = (date: Date) => formatInAppTimezone(date);

	const formatDuration = (timeIn: Date | null, timeOut: Date | null) => {
		if (!timeIn) return "-";
		const startTime = new Date(timeIn).getTime();
		const endTime = timeOut ? new Date(timeOut).getTime() : Date.now();
		const durationMs = endTime - startTime;
		const hours = Math.floor(durationMs / (1000 * 60 * 60));
		const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
		return `${hours}h ${minutes}m`;
	};

	const getStatusBadge = (record: {
		status: string;
		droppedNotes?: string | null;
	}) => {
		switch (record.status) {
			case "upcoming":
				return (
					<Badge variant="outline" className="text-muted-foreground">
						Upcoming
					</Badge>
				);
			case "present":
				return <Badge className="bg-green-600">Present</Badge>;
			case "absent":
				return <Badge variant="destructive">Absent</Badge>;
			case "dropped":
			case "dropped_makeup":
				return (
					<div className="flex flex-col gap-1">
						<Badge variant="outline">
							{record.status === "dropped" ? "Dropped" : "Dropped w/ Makeup"}
						</Badge>
					</div>
				);
			default:
				return <Badge variant="outline">{record.status}</Badge>;
		}
	};

	const renderStatusFlags = (record?: {
		didArriveLate?: boolean | null;
		didLeaveEarly?: boolean | null;
		isMakeup?: boolean | null;
	}) => {
		if (!record) return null;
		const badges: React.ReactNode[] = [];
		if (record.isMakeup) {
			badges.push(
				<Badge key="makeup" variant="outline">
					Makeup
				</Badge>,
			);
		}
		if (record.didArriveLate) {
			badges.push(
				<Badge key="late" className="bg-yellow-600">
					Arrived Late
				</Badge>,
			);
		}
		if (record.didLeaveEarly) {
			badges.push(
				<Badge key="left-early" className="bg-orange-600">
					Left Early
				</Badge>,
			);
		}
		return badges.length > 0 ? (
			<div className="flex flex-wrap gap-1">{badges}</div>
		) : null;
	};

	const getDayOfWeek = (dayNum: number) => {
		const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
		return days[dayNum];
	};

	return (
		<div className="container p-4 space-y-4">
			<h1 className="text-2xl font-bold">Shift Attendance</h1>

			{/* Stats Cards */}
			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">Total Shifts</CardTitle>
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
						<CardTitle className="text-sm font-medium">Time on Shift</CardTitle>
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
								<p className="text-xs text-muted-foreground">without makeup</p>
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
					<div className="flex justify-between items-center">
						<div>
							<CardTitle>Attendance Records</CardTitle>
							<CardDescription>
								View your shift attendance records for this period
							</CardDescription>
						</div>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="outline">
									{pageSize} per page{" "}
									<ChevronDownIcon className="ml-2 size-4" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								{[10, 20, 50, 100].map((size) => (
									<DropdownMenuItem
										key={size}
										onClick={() => {
											setPageSize(size);
											setPage(1);
										}}
									>
										{size} per page
									</DropdownMenuItem>
								))}
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</CardHeader>
				<CardContent>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Shift</TableHead>
								<TableHead>Date & Time</TableHead>
								<TableHead>Status</TableHead>
								<TableHead>Time In</TableHead>
								<TableHead>Time Out</TableHead>
								<TableHead>Duration</TableHead>
								<TableHead>% On Shift</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{attendanceLoading ? (
								<TableRow>
									<TableCell colSpan={7} className="text-center">
										Loading...
									</TableCell>
								</TableRow>
							) : attendances.length === 0 ? (
								<TableRow>
									<TableCell colSpan={7} className="text-center">
										No attendance records found
									</TableCell>
								</TableRow>
							) : (
								attendances.map((attendance) => (
									<TableRow key={attendance.id}>
										<TableCell>
											<div className="flex flex-col">
												<span className="font-medium">
													{
														attendance.shiftOccurrence.shiftSchedule.shiftType
															.name
													}
												</span>
												<span className="text-xs text-muted-foreground">
													{
														attendance.shiftOccurrence.shiftSchedule.shiftType
															.location
													}
												</span>
											</div>
										</TableCell>
										<TableCell>
											<div className="flex flex-col">
												<span>
													{formatDate(attendance.shiftOccurrence.timestamp)}
												</span>
												<span className="text-xs text-muted-foreground">
													{getDayOfWeek(
														attendance.shiftOccurrence.shiftSchedule.dayOfWeek,
													)}{" "}
													{formatTimeRange(
														attendance.shiftOccurrence.shiftSchedule.startTime,
														attendance.shiftOccurrence.shiftSchedule.endTime,
													)}
												</span>
											</div>
										</TableCell>
										<TableCell>
											<div className="flex flex-col gap-1">
												{getStatusBadge(attendance)}
												{renderStatusFlags(attendance)}
											</div>
										</TableCell>
										<TableCell>
											{attendance.timeIn ? formatDate(attendance.timeIn) : "-"}
										</TableCell>
										<TableCell>
											{attendance.timeOut
												? formatDate(attendance.timeOut)
												: "-"}
										</TableCell>
										<TableCell>
											{formatDuration(attendance.timeIn, attendance.timeOut)}
										</TableCell>
										<TableCell>
											{attendance.timeOnShiftPercentage !== null &&
											attendance.timeOnShiftPercentage !== undefined ? (
												<span
													className={
														attendance.timeOnShiftPercentage >= 90
															? "text-green-600 font-medium"
															: attendance.timeOnShiftPercentage >= 70
																? "text-yellow-600 font-medium"
																: "text-orange-600 font-medium"
													}
												>
													{attendance.timeOnShiftPercentage}%
												</span>
											) : (
												<span className="text-muted-foreground">-</span>
											)}
										</TableCell>
									</TableRow>
								))
							)}
						</TableBody>
					</Table>

					{total > 0 && (
						<div className="flex flex-col justify-between items-center gap-2 mt-4">
							<TablePagination
								page={page}
								totalPages={totalPages}
								onPageChange={setPage}
							/>
							<p className="text-sm text-muted-foreground">
								Showing {offset + 1} - {offset + attendances.length} of {total}
							</p>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
