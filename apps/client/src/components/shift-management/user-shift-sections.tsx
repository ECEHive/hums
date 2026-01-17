import type { UseMutationResult, UseQueryResult } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { TablePagination } from "@/components/shared/table-pagination";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { formatDateInAppTimezone, formatTimeRange } from "@/lib/timezone";

const DAYS_OF_WEEK = [
	"Sunday",
	"Monday",
	"Tuesday",
	"Wednesday",
	"Thursday",
	"Friday",
	"Saturday",
];

const PAGE_SIZE = 10;
const ASSIGNED_PAGE_SIZE = 8;
const UPCOMING_PAGE_SIZE = 6;
const ATTENDANCE_PAGE_SIZE = 8;

type AttendanceStatsSnapshot = {
	attended: number;
	missed: number;
	dropped: number;
	droppedWithMakeup: number;
	totalScheduledHours: number;
	totalActualHours: number;
	attendanceCoveragePercent: number;
};

const EMPTY_ATTENDANCE_STATS: AttendanceStatsSnapshot = {
	attended: 0,
	missed: 0,
	dropped: 0,
	droppedWithMakeup: 0,
	totalScheduledHours: 0,
	totalActualHours: 0,
	attendanceCoveragePercent: 0,
};

type ScheduleFilters = {
	search: string;
	shiftTypeId: number | "all";
	dayOfWeek: number | "all";
};

type ShiftTypeOption = {
	id: number;
	name: string;
};

// Type definitions for the data from tRPC
export type ScheduleManagementData = {
	period: {
		id: number;
		name: string;
	} | null;
	schedules: Array<{
		id: number;
		shiftTypeId: number;
		shiftTypeName: string;
		shiftTypeLocation: string | null;
		dayOfWeek: number;
		startTime: string;
		endTime: string;
		slots: number;
		assignedUserCount: number;
		availableSlots: number;
		isRegistered: boolean;
	}>;
};

export type UpcomingData = {
	total: number;
	occurrences: Array<{
		id: number;
		timestamp: Date;
		startTime: string;
		endTime: string;
		shiftTypeName: string;
	}>;
};

export type AttendanceData = {
	total: number;
	stats: AttendanceStatsSnapshot;
	attendances: Array<{
		id: number;
		status: string;
		scheduledHours: number | null;
		actualHours: number | null;
		shiftOccurrence: {
			timestamp: Date;
			shiftSchedule: {
				shiftType: {
					name: string;
				};
			};
		};
	}>;
};

function getErrorMessage(error: unknown) {
	if (error instanceof Error) return error.message;
	if (typeof error === "string") return error;
	return "Something went wrong";
}

function formatStatusLabel(status: string) {
	return status
		.split("_")
		.map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
		.join(" ");
}

function createDefaultFilters(): ScheduleFilters {
	return {
		search: "",
		shiftTypeId: "all",
		dayOfWeek: "all",
	};
}

// Summary stat component
export function SummaryStat({
	label,
	value,
}: {
	label: string;
	value: number;
}) {
	return (
		<div className="rounded-lg border bg-muted/40 p-3">
			<p className="text-xs font-medium uppercase text-muted-foreground">
				{label}
			</p>
			<p className="text-2xl font-semibold">{value}</p>
		</div>
	);
}

// Attendance stats summary component
export function AttendanceStatsSummary({
	stats,
}: {
	stats: AttendanceStatsSnapshot;
}) {
	const coveragePercent = stats.attendanceCoveragePercent;
	const scheduledHoursLabel = `${stats.totalScheduledHours.toFixed(1)}h`;
	const actualHoursLabel = `${stats.totalActualHours.toFixed(1)}h`;

	return (
		<div className="space-y-3">
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<SummaryStat label="Attended" value={stats.attended} />
				<SummaryStat label="Missed" value={stats.missed} />
				<SummaryStat label="Dropped" value={stats.dropped} />
				<SummaryStat label="Dropped + Makeup" value={stats.droppedWithMakeup} />
			</div>
			<div className="rounded-md border bg-muted/30 p-3">
				<p className="text-xs font-medium uppercase text-muted-foreground">
					Attendance coverage
				</p>
				<p className="text-lg font-semibold">
					{coveragePercent.toFixed(1)}% ({actualHoursLabel} /{" "}
					{scheduledHoursLabel})
				</p>
			</div>
		</div>
	);
}

type ScheduleSectionProps = {
	query: UseQueryResult<ScheduleManagementData | null, Error>;
	assignMutation: UseMutationResult<void, Error, number, unknown>;
	unassignMutation: UseMutationResult<void, Error, number, unknown>;
	activeUserId: number | null;
};

export function SchedulesSection({
	query,
	assignMutation,
	unassignMutation,
	activeUserId,
}: ScheduleSectionProps) {
	const [filters, setFilters] = useState<ScheduleFilters>(() =>
		createDefaultFilters(),
	);
	const [page, setPage] = useState(1);

	useEffect(() => {
		setFilters(createDefaultFilters());
		setPage(1);
	}, [activeUserId]);

	useEffect(() => {
		setPage(1);
	}, [filters.search, filters.shiftTypeId, filters.dayOfWeek]);

	const schedules =
		query.data?.schedules ?? ([] as ScheduleManagementData["schedules"]);

	const shiftTypeOptions: ShiftTypeOption[] = useMemo(() => {
		const entries = new Map<number, string>();
		schedules.forEach((schedule) => {
			entries.set(schedule.shiftTypeId, schedule.shiftTypeName);
		});
		return Array.from(entries.entries())
			.sort((a, b) => a[1].localeCompare(b[1]))
			.map(([id, name]) => ({ id, name }));
	}, [schedules]);

	const filteredSchedules = useMemo(() => {
		const search = filters.search.trim().toLowerCase();
		return schedules.filter((schedule) => {
			if (
				filters.shiftTypeId !== "all" &&
				schedule.shiftTypeId !== filters.shiftTypeId
			) {
				return false;
			}
			if (
				filters.dayOfWeek !== "all" &&
				schedule.dayOfWeek !== filters.dayOfWeek
			) {
				return false;
			}
			if (search) {
				const haystack =
					`${schedule.shiftTypeName} ${schedule.shiftTypeLocation ?? ""} ${DAYS_OF_WEEK[schedule.dayOfWeek]} ${schedule.startTime} ${schedule.endTime}`.toLowerCase();
				return haystack.includes(search);
			}
			return true;
		});
	}, [filters, schedules]);

	const totalItems = filteredSchedules.length;
	const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
	const displayPage = Math.min(page, totalPages);
	const pageStartIndex = totalItems === 0 ? 0 : (displayPage - 1) * PAGE_SIZE;
	const pageEndIndex =
		totalItems === 0 ? 0 : Math.min(pageStartIndex + PAGE_SIZE, totalItems);
	const visibleSchedules = filteredSchedules.slice(
		pageStartIndex,
		pageEndIndex,
	);
	const hasActiveFilters =
		filters.search.trim().length > 0 ||
		filters.shiftTypeId !== "all" ||
		filters.dayOfWeek !== "all";
	const showingSubset = filteredSchedules.length !== schedules.length;
	const summaryText =
		filteredSchedules.length === 0
			? "No shifts match the current filters."
			: `Showing ${pageStartIndex + 1}-${pageEndIndex} of ${filteredSchedules.length} shift${
					filteredSchedules.length === 1 ? "" : "s"
				}${showingSubset ? ` (filtered from ${schedules.length})` : ""}`;

	if (query.isLoading) {
		return (
			<div className="flex justify-center py-10">
				<Spinner />
			</div>
		);
	}

	if (query.error) {
		return (
			<Alert variant="destructive">
				<AlertTitle>Unable to load schedules</AlertTitle>
				<AlertDescription>
					{getErrorMessage(query.error as Error)}
				</AlertDescription>
			</Alert>
		);
	}

	if (schedules.length === 0) {
		return (
			<p className="text-sm text-muted-foreground">
				No shift schedules found for this period.
			</p>
		);
	}

	return (
		<div className="space-y-4">
			<div className="space-y-3 rounded-lg border bg-muted/20 p-3">
				<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
					<div className="space-y-1">
						<p className="text-sm font-medium">Search</p>
						<Input
							value={filters.search}
							onChange={(event) =>
								setFilters((prev) => ({
									...prev,
									search: event.target.value,
								}))
							}
							placeholder="Search by name, location, or time"
						/>
					</div>
					<div className="space-y-1">
						<p className="text-sm font-medium">Shift type</p>
						<Select
							value={
								filters.shiftTypeId === "all"
									? "all"
									: String(filters.shiftTypeId)
							}
							onValueChange={(value) =>
								setFilters((prev) => ({
									...prev,
									shiftTypeId: value === "all" ? "all" : Number(value),
								}))
							}
						>
							<SelectTrigger className="w-full justify-between">
								<SelectValue placeholder="All shift types" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All shift types</SelectItem>
								{shiftTypeOptions.map((option) => (
									<SelectItem key={option.id} value={String(option.id)}>
										{option.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="space-y-1">
						<p className="text-sm font-medium">Day of week</p>
						<Select
							value={
								filters.dayOfWeek === "all" ? "all" : String(filters.dayOfWeek)
							}
							onValueChange={(value) =>
								setFilters((prev) => ({
									...prev,
									dayOfWeek: value === "all" ? "all" : Number(value),
								}))
							}
						>
							<SelectTrigger className="w-full justify-between">
								<SelectValue placeholder="All days" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All days</SelectItem>
								{DAYS_OF_WEEK.map((label, index) => (
									<SelectItem key={label} value={String(index)}>
										{label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</div>
				<div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
					<span>{summaryText}</span>
					<Button
						variant="ghost"
						size="sm"
						onClick={() => {
							setFilters(createDefaultFilters());
							setPage(1);
						}}
						disabled={!hasActiveFilters}
					>
						Reset filters
					</Button>
				</div>
			</div>

			{filteredSchedules.length === 0 ? (
				<div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
					Adjust or clear filters to see matching shifts.
				</div>
			) : (
				<>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Shift</TableHead>
								<TableHead>Day / Time</TableHead>
								<TableHead>Slots</TableHead>
								<TableHead className="text-right">
									<span className="sr-only">Actions</span>
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{visibleSchedules.map((schedule) => {
								const shiftLabel = (
									<div>
										<p className="font-medium">{schedule.shiftTypeName}</p>
										<p className="text-xs text-muted-foreground">
											{schedule.shiftTypeLocation ?? ""}
										</p>
									</div>
								);
								const timeLabel = `${DAYS_OF_WEEK[schedule.dayOfWeek]} · ${schedule.startTime} - ${schedule.endTime}`;
								const isFull = schedule.availableSlots <= 0;
								const assigning =
									assignMutation.isPending &&
									assignMutation.variables === schedule.id;
								const unassigning =
									unassignMutation.isPending &&
									unassignMutation.variables === schedule.id;
								return (
									<TableRow key={schedule.id}>
										<TableCell>{shiftLabel}</TableCell>
										<TableCell>
											<div className="flex flex-col gap-1">
												<span>{timeLabel}</span>
												<Badge
													variant={
														schedule.isRegistered ? "default" : "secondary"
													}
												>
													{schedule.isRegistered ? "Assigned" : "Available"}
												</Badge>
											</div>
										</TableCell>
										<TableCell>
											{schedule.assignedUserCount} / {schedule.slots}
											{isFull && !schedule.isRegistered ? (
												<p className="text-xs text-muted-foreground">
													No open slots
												</p>
											) : null}
										</TableCell>
										<TableCell className="text-right">
											{schedule.isRegistered ? (
												<Button
													variant="ghost"
													size="sm"
													disabled={unassigning}
													onClick={() => unassignMutation.mutate(schedule.id)}
												>
													{unassigning ? "Removing..." : "Remove"}
												</Button>
											) : (
												<Button
													size="sm"
													disabled={isFull || assigning}
													onClick={() => assignMutation.mutate(schedule.id)}
												>
													{assigning ? "Assigning..." : "Assign"}
												</Button>
											)}
										</TableCell>
									</TableRow>
								);
							})}
						</TableBody>
					</Table>

					{totalPages > 1 ? (
						<div className="flex justify-end pt-2">
							<TablePagination
								page={displayPage}
								totalPages={totalPages}
								onPageChange={setPage}
							/>
						</div>
					) : null}
				</>
			)}
		</div>
	);
}

type AssignedSchedulesSectionProps = {
	query: UseQueryResult<ScheduleManagementData | null, Error>;
	unassignMutation: UseMutationResult<void, Error, number, unknown>;
	activeUserId: number | null;
};

export function AssignedSchedulesSection({
	query,
	unassignMutation,
	activeUserId,
}: AssignedSchedulesSectionProps) {
	const [page, setPage] = useState(1);

	useEffect(() => {
		setPage(1);
	}, [activeUserId]);

	if (query.isLoading) {
		return (
			<div className="flex justify-center py-6">
				<Spinner />
			</div>
		);
	}

	if (query.error) {
		return (
			<Alert variant="destructive">
				<AlertTitle>Unable to load assignments</AlertTitle>
				<AlertDescription>
					{getErrorMessage(query.error as Error)}
				</AlertDescription>
			</Alert>
		);
	}

	const schedules = query.data?.schedules ?? [];
	const assignedSchedules = schedules.filter(
		(schedule) => schedule.isRegistered,
	);

	if (assignedSchedules.length === 0) {
		return (
			<p className="text-sm text-muted-foreground">
				No shifts are currently assigned to this user.
			</p>
		);
	}

	const totalPages = Math.max(
		1,
		Math.ceil(assignedSchedules.length / ASSIGNED_PAGE_SIZE),
	);
	const displayPage = Math.min(page, totalPages);
	const startIndex =
		assignedSchedules.length === 0 ? 0 : (displayPage - 1) * ASSIGNED_PAGE_SIZE;
	const visibleSchedules = assignedSchedules.slice(
		startIndex,
		startIndex + ASSIGNED_PAGE_SIZE,
	);

	return (
		<div className="space-y-3">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Shift</TableHead>
						<TableHead>Day / Time</TableHead>
						<TableHead>Slots</TableHead>
						<TableHead className="text-right">
							<span className="sr-only">Actions</span>
						</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{visibleSchedules.map((schedule) => {
						const timeLabel = `${DAYS_OF_WEEK[schedule.dayOfWeek]} · ${schedule.startTime} - ${schedule.endTime}`;
						const removing =
							unassignMutation.isPending &&
							unassignMutation.variables === schedule.id;
						return (
							<TableRow key={schedule.id}>
								<TableCell>
									<p className="font-medium">{schedule.shiftTypeName}</p>
									<p className="text-xs text-muted-foreground">
										{schedule.shiftTypeLocation ?? ""}
									</p>
								</TableCell>
								<TableCell>{timeLabel}</TableCell>
								<TableCell>
									{schedule.assignedUserCount} / {schedule.slots}
								</TableCell>
								<TableCell className="text-right">
									<Button
										variant="ghost"
										size="sm"
										disabled={removing}
										onClick={() => unassignMutation.mutate(schedule.id)}
									>
										{removing ? "Removing..." : "Remove"}
									</Button>
								</TableCell>
							</TableRow>
						);
					})}
				</TableBody>
			</Table>
			<div className="flex items-center justify-between text-sm text-muted-foreground">
				<span>
					Showing {startIndex + 1}-
					{Math.min(startIndex + ASSIGNED_PAGE_SIZE, assignedSchedules.length)}{" "}
					of {assignedSchedules.length}
				</span>
				{totalPages > 1 ? (
					<TablePagination
						page={displayPage}
						totalPages={totalPages}
						onPageChange={setPage}
					/>
				) : null}
			</div>
		</div>
	);
}

type UpcomingSectionProps = {
	query: UseQueryResult<UpcomingData | null, Error>;
	activeUserId: number | null;
};

export function UpcomingSection({ query, activeUserId }: UpcomingSectionProps) {
	const [page, setPage] = useState(1);

	useEffect(() => {
		setPage(1);
	}, [activeUserId]);

	if (query.isLoading) {
		return (
			<div className="flex justify-center py-6">
				<Spinner />
			</div>
		);
	}

	if (query.error) {
		return (
			<Alert variant="destructive">
				<AlertTitle>Unable to load upcoming shifts</AlertTitle>
				<AlertDescription>
					{getErrorMessage(query.error as Error)}
				</AlertDescription>
			</Alert>
		);
	}

	const occurrences =
		query.data?.occurrences ?? ([] as UpcomingData["occurrences"]);

	if (occurrences.length === 0) {
		return (
			<p className="text-sm text-muted-foreground">
				No upcoming shifts for this user.
			</p>
		);
	}

	const totalPages = Math.max(
		1,
		Math.ceil(occurrences.length / UPCOMING_PAGE_SIZE),
	);
	const displayPage = Math.min(page, totalPages);
	const startIndex = (displayPage - 1) * UPCOMING_PAGE_SIZE;
	const visibleOccurrences = occurrences.slice(
		startIndex,
		startIndex + UPCOMING_PAGE_SIZE,
	);

	return (
		<div className="space-y-4">
			{visibleOccurrences.map((occurrence) => {
				const dateLabel = formatDateInAppTimezone(occurrence.timestamp, {
					formatString: "ddd, MMM D",
				});
				const timeLabel = formatTimeRange(
					occurrence.startTime,
					occurrence.endTime,
					{ referenceDate: occurrence.timestamp },
				);
				return (
					<div
						key={occurrence.id}
						className="rounded-md border bg-muted/30 p-3"
					>
						<p className="font-medium">{occurrence.shiftTypeName}</p>
						<p className="text-sm text-muted-foreground">
							{dateLabel} · {timeLabel}
						</p>
					</div>
				);
			})}
			{totalPages > 1 ? (
				<div className="flex justify-end">
					<TablePagination
						page={displayPage}
						totalPages={totalPages}
						onPageChange={setPage}
					/>
				</div>
			) : null}
		</div>
	);
}

type AttendanceSectionProps = {
	query: UseQueryResult<AttendanceData | null, Error>;
	activeUserId: number | null;
};

export function AttendanceSection({
	query,
	activeUserId,
}: AttendanceSectionProps) {
	const [page, setPage] = useState(1);

	useEffect(() => {
		setPage(1);
	}, [activeUserId]);

	const stats = query.data?.stats ?? EMPTY_ATTENDANCE_STATS;
	const records =
		query.data?.attendances ?? ([] as AttendanceData["attendances"]);
	const hasRecords = records.length > 0;
	const totalPages = hasRecords
		? Math.max(1, Math.ceil(records.length / ATTENDANCE_PAGE_SIZE))
		: 1;
	const displayPage = Math.min(page, totalPages);
	const startIndex = hasRecords ? (displayPage - 1) * ATTENDANCE_PAGE_SIZE : 0;
	const visibleRecords = hasRecords
		? records.slice(startIndex, startIndex + ATTENDANCE_PAGE_SIZE)
		: [];

	if (query.isLoading) {
		return (
			<div className="flex justify-center py-6">
				<Spinner />
			</div>
		);
	}

	if (query.error) {
		return (
			<Alert variant="destructive">
				<AlertTitle>Unable to load attendance</AlertTitle>
				<AlertDescription>
					{getErrorMessage(query.error as Error)}
				</AlertDescription>
			</Alert>
		);
	}

	return (
		<div className="space-y-4">
			<AttendanceStatsSummary stats={stats} />
			{!hasRecords ? (
				<p className="text-sm text-muted-foreground">
					No attendance records for this period.
				</p>
			) : (
				<>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Date</TableHead>
								<TableHead>Shift</TableHead>
								<TableHead>Status</TableHead>
								<TableHead>Hours</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{visibleRecords.map((record) => {
								const date = formatDateInAppTimezone(
									record.shiftOccurrence.timestamp,
									{ formatString: "MMM D, YYYY" },
								);
								const statusLabel = formatStatusLabel(record.status);
								const scheduledDisplay =
									typeof record.scheduledHours === "number"
										? `${record.scheduledHours.toFixed(1)}h`
										: "–";
								const actualDisplay =
									typeof record.actualHours === "number"
										? `${record.actualHours.toFixed(1)}h`
										: "–";
								return (
									<TableRow key={record.id}>
										<TableCell>{date}</TableCell>
										<TableCell>
											{record.shiftOccurrence.shiftSchedule.shiftType.name}
										</TableCell>
										<TableCell>
											<Badge variant="outline">{statusLabel}</Badge>
										</TableCell>
										<TableCell>
											{actualDisplay} / {scheduledDisplay}
										</TableCell>
									</TableRow>
								);
							})}
						</TableBody>
					</Table>
					{totalPages > 1 ? (
						<div className="flex justify-end">
							<TablePagination
								page={displayPage}
								totalPages={totalPages}
								onPageChange={setPage}
							/>
						</div>
					) : null}
				</>
			)}
		</div>
	);
}
