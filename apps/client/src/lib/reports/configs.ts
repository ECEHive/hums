import type { ColumnDef } from "@tanstack/react-table";
import {
	CalendarIcon,
	ClipboardListIcon,
	ClockIcon,
	FileSpreadsheetIcon,
	UserSearchIcon,
	UsersIcon,
} from "lucide-react";
import type {
	ExportFormat,
	ReportConfig,
	SessionActivityReport,
	ShiftCoverageReport,
	ShiftUsersReport,
	UserAttendanceReport,
	UserScheduleSummary,
} from "./types";
import {
	DAYS_OF_WEEK,
	formatDate,
	formatDuration,
	formatHours,
	formatPercentage,
} from "./utils";

/**
 * Default export formats available for all reports.
 * Centralized here to avoid repetition across report configurations.
 */
const DEFAULT_EXPORT_FORMATS: ExportFormat[] = ["csv", "html"];

/**
 * User Attendance Report Configuration
 */
export const userAttendanceReportConfig: ReportConfig<UserAttendanceReport> = {
	id: "user-attendance",
	name: "User Attendance Report",
	description:
		"Track user attendance, scheduled hours, and attendance percentages over a date range",
	icon: ClipboardListIcon,
	permissions: ["period.reports"],
	requiresPeriod: true,
	filters: [
		{
			id: "dateRange",
			type: "date-range",
			label: "Date Range",
			description: "Select the date range for the report",
			required: true,
		},
	],
	getColumns: (): ColumnDef<UserAttendanceReport, unknown>[] => [
		{
			accessorKey: "name",
			header: "Full Name",
			cell: ({ row }) => row.original.name,
		},
		{
			accessorKey: "username",
			header: "Username",
			cell: ({ row }) => row.original.username,
		},
		{
			accessorKey: "periodScheduledTime",
			header: "Scheduled Time",
			cell: ({ row }) => formatHours(row.original.periodScheduledTime),
		},
		{
			accessorKey: "pastScheduledTime",
			header: "Past Scheduled",
			cell: ({ row }) => formatHours(row.original.pastScheduledTime),
		},
		{
			accessorKey: "pastAttendedTime",
			header: "Attended Time",
			cell: ({ row }) => formatHours(row.original.pastAttendedTime),
		},
		{
			accessorKey: "pastMissedTime",
			header: "Missed Time",
			cell: ({ row }) => formatHours(row.original.pastMissedTime),
		},
		{
			accessorKey: "pastAttendancePercentage",
			header: "Attendance %",
			cell: ({ row }) =>
				formatPercentage(row.original.pastAttendancePercentage),
		},
	],
	exportFormats: DEFAULT_EXPORT_FORMATS,
};

/**
 * Session Activity Report Configuration
 */
export const sessionActivityReportConfig: ReportConfig<SessionActivityReport> =
	{
		id: "session-activity",
		name: "Session Activity Report",
		description: "Analyze user session patterns, duration, and frequency",
		icon: ClockIcon,
		permissions: ["period.reports"],
		requiresPeriod: false,
		filters: [
			{
				id: "dateRange",
				type: "date-range",
				label: "Date Range",
				description: "Select the date range for the report",
				required: true,
			},
		],
		getColumns: (): ColumnDef<SessionActivityReport, unknown>[] => [
			{
				accessorKey: "name",
				header: "Full Name",
				cell: ({ row }) => row.original.name,
			},
			{
				accessorKey: "username",
				header: "Username",
				cell: ({ row }) => row.original.username,
			},
			{
				accessorKey: "totalSessions",
				header: "Total Sessions",
				cell: ({ row }) => row.original.totalSessions,
			},
			{
				accessorKey: "totalDuration",
				header: "Total Duration",
				cell: ({ row }) => formatDuration(row.original.totalDuration),
			},
			{
				accessorKey: "averageSessionDuration",
				header: "Avg. Duration",
				cell: ({ row }) => formatDuration(row.original.averageSessionDuration),
			},
			{
				accessorKey: "lastSessionDate",
				header: "Last Session",
				cell: ({ row }) => formatDate(row.original.lastSessionDate),
			},
		],
		exportFormats: DEFAULT_EXPORT_FORMATS,
	};

/**
 * Shift Coverage Report Configuration
 */
export const shiftCoverageReportConfig: ReportConfig<ShiftCoverageReport> = {
	id: "shift-coverage",
	name: "Shift Coverage Report",
	description:
		"View shift type coverage with filled vs total slots per time period",
	icon: CalendarIcon,
	permissions: ["period.reports"],
	requiresPeriod: true,
	filters: [
		{
			id: "shiftTypes",
			type: "multi-select",
			label: "Shift Types",
			description: "Filter by specific shift types (leave empty for all)",
			required: false,
		},
		{
			id: "daysOfWeek",
			type: "multi-select",
			label: "Days of Week",
			description: "Filter by specific days",
			required: false,
			options: DAYS_OF_WEEK.map((d) => ({ value: d.value, label: d.label })),
		},
	],
	getColumns: (): ColumnDef<ShiftCoverageReport, unknown>[] => [
		{
			accessorKey: "shiftTypeName",
			header: "Shift Type",
			cell: ({ row }) => row.original.shiftTypeName,
		},
		{
			accessorKey: "shiftTypeLocation",
			header: "Location",
			cell: ({ row }) => row.original.shiftTypeLocation || "—",
		},
		{
			accessorKey: "timeSlot",
			header: "Time Slot",
			cell: ({ row }) => row.original.timeSlot,
		},
		{
			accessorKey: "totalSlots",
			header: "Total Slots",
			cell: ({ row }) => row.original.totalSlots,
		},
		{
			accessorKey: "filledSlots",
			header: "Filled Slots",
			cell: ({ row }) => row.original.filledSlots,
		},
		{
			accessorKey: "coveragePercentage",
			header: "Coverage %",
			cell: ({ row }) => formatPercentage(row.original.coveragePercentage),
		},
	],
	exportFormats: DEFAULT_EXPORT_FORMATS,
};

/**
 * User Schedule Summary Report Configuration
 */
export const userScheduleSummaryConfig: ReportConfig<UserScheduleSummary> = {
	id: "user-schedule-summary",
	name: "User Schedule Summary",
	description:
		"Overview of user weekly schedules with total hours and shift types",
	icon: UsersIcon,
	permissions: ["period.reports"],
	requiresPeriod: true,
	filters: [
		{
			id: "shiftTypes",
			type: "multi-select",
			label: "Shift Types",
			description: "Filter by specific shift types (leave empty for all)",
			required: false,
		},
	],
	getColumns: (): ColumnDef<UserScheduleSummary, unknown>[] => [
		{
			accessorKey: "name",
			header: "Full Name",
			cell: ({ row }) => row.original.name,
		},
		{
			accessorKey: "username",
			header: "Username",
			cell: ({ row }) => row.original.username,
		},
		{
			accessorKey: "email",
			header: "Email",
			cell: ({ row }) => row.original.email,
		},
		{
			accessorKey: "totalScheduledHours",
			header: "Weekly Hours",
			cell: ({ row }) => formatHours(row.original.totalScheduledHours),
		},
		{
			accessorKey: "shiftsPerWeek",
			header: "Shifts/Week",
			cell: ({ row }) => row.original.shiftsPerWeek,
		},
		{
			accessorKey: "shiftTypes",
			header: "Shift Types",
			cell: ({ row }) => row.original.shiftTypes.join(", ") || "—",
		},
		{
			accessorKey: "daysScheduled",
			header: "Days Scheduled",
			cell: ({ row }) => row.original.daysScheduled.join(", ") || "—",
		},
	],
	exportFormats: DEFAULT_EXPORT_FORMATS,
};

/**
 * Shift Users Report Configuration
 * Lists unique users who have shifts during a specific time period
 */
export const shiftUsersReportConfig: ReportConfig<ShiftUsersReport> = {
	id: "shift-users",
	name: "Shift Users Report",
	description:
		"List of unique users with shifts during a specific day/time range",
	icon: UserSearchIcon,
	permissions: ["period.reports"],
	requiresPeriod: true,
	filters: [
		{
			id: "shiftTypes",
			type: "multi-select",
			label: "Shift Types",
			description: "Filter by specific shift types (leave empty for all)",
			required: false,
		},
		{
			id: "dayOfWeek",
			type: "select",
			label: "Day of Week",
			description: "Filter by a specific day (optional)",
			required: false,
			options: [
				{ value: -1, label: "All Days" },
				...DAYS_OF_WEEK.map((d) => ({ value: d.value, label: d.label })),
			],
		},
		{
			id: "timeRange",
			type: "date-range",
			label: "Time Range",
			description: "Filter by time of day (optional)",
			required: false,
		},
	],
	getColumns: (): ColumnDef<ShiftUsersReport, unknown>[] => [
		{
			accessorKey: "name",
			header: "Full Name",
			cell: ({ row }) => row.original.name,
		},
		{
			accessorKey: "username",
			header: "Username",
			cell: ({ row }) => row.original.username,
		},
		{
			accessorKey: "email",
			header: "Email",
			cell: ({ row }) => row.original.email,
		},
		{
			accessorKey: "shiftCount",
			header: "Shift Count",
			cell: ({ row }) => row.original.shiftCount,
		},
		{
			accessorKey: "shiftTypes",
			header: "Shift Types",
			cell: ({ row }) => row.original.shiftTypes || "—",
		},
	],
	exportFormats: DEFAULT_EXPORT_FORMATS,
};

/**
 * Schedule Export Report Configuration (replaces old export page)
 */
export interface ScheduleExportReport {
	timeSlot: string;
	dayOfWeek: number;
	startTime: string;
	[key: string]: string | number | { id: number; name: string }[] | undefined;
}

export const scheduleExportReportConfig: ReportConfig<ScheduleExportReport> = {
	id: "schedule-export",
	name: "Schedule Export",
	description:
		"Generate a printable PDF of shift schedules with user assignments",
	icon: FileSpreadsheetIcon,
	permissions: ["period.reports"],
	requiresPeriod: true,
	filters: [
		{
			id: "shiftTypes",
			type: "multi-select",
			label: "Shift Types",
			description: "Filter by specific shift types (leave empty for all)",
			required: false,
		},
		{
			id: "daysOfWeek",
			type: "multi-select",
			label: "Days of Week",
			description: "Filter by specific days",
			required: false,
			options: DAYS_OF_WEEK.map((d) => ({ value: d.value, label: d.label })),
			defaultValue: [0, 1, 2, 3, 4, 5, 6],
		},
	],
	getColumns: (): ColumnDef<ScheduleExportReport, unknown>[] => [
		{
			accessorKey: "timeSlot",
			header: "Day & Time",
			cell: ({ row }) => row.original.timeSlot,
		},
		// Dynamic columns for shift types are added at runtime
	],
	exportFormats: DEFAULT_EXPORT_FORMATS,
};

/**
 * All available report configurations
 */
export const reportConfigs: ReportConfig<Record<string, unknown>>[] = [
	userAttendanceReportConfig as unknown as ReportConfig<
		Record<string, unknown>
	>,
	sessionActivityReportConfig as unknown as ReportConfig<
		Record<string, unknown>
	>,
	shiftCoverageReportConfig as unknown as ReportConfig<Record<string, unknown>>,
	userScheduleSummaryConfig as unknown as ReportConfig<Record<string, unknown>>,
	shiftUsersReportConfig as unknown as ReportConfig<Record<string, unknown>>,
	scheduleExportReportConfig as unknown as ReportConfig<
		Record<string, unknown>
	>,
];

/**
 * Get a report configuration by ID
 */
export function getReportConfig(
	reportId: string,
): ReportConfig<Record<string, unknown>> | undefined {
	return reportConfigs.find((config) => config.id === reportId);
}
