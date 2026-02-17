import type { ColumnDef } from "@tanstack/react-table";
import { ClipboardListIcon, FileClockIcon, UsersIcon } from "lucide-react";
import type { ExportFormat, ReportConfig } from "./types";
import { formatDate, formatHours } from "./utils";

/**
 * Default export formats available for all reports.
 */
const DEFAULT_EXPORT_FORMATS: ExportFormat[] = ["csv", "html"];

/**
 * Global report permission
 */
export const GLOBAL_REPORTS_PERMISSION = "global_reports.generate";

// ============================================================================
// Type Definitions for Global Reports
// ============================================================================

/**
 * Users report data
 */
export interface GlobalUsersReport {
	id: number;
	username: string;
	name: string;
	email: string;
	slackUsername: string | null;
	isSystemUser: boolean;
	createdAt: Date;
	roles: string;
	roleCount: number;
	totalSessions: number;
}

/**
 * Sessions report data
 */
export interface GlobalSessionsReport {
	id: number;
	userId: number;
	username: string;
	userName: string;
	userEmail: string;
	sessionType: "regular" | "staffing";
	startedAt: Date;
	endedAt: Date | null;
	durationMinutes: number;
	isOngoing: boolean;
}

/**
 * User sessions report data (aggregate)
 */
export interface GlobalUserSessionsReport {
	id: number;
	username: string;
	name: string;
	email: string;
	roles: string;
	totalSessions: number;
	regularSessions: number;
	staffingSessions: number;
	totalHours: number;
	averageHours: number;
	firstSessionDate: Date | null;
	lastSessionDate: Date | null;
}

// ============================================================================
// Report Configurations
// ============================================================================

/**
 * Global Users Report Configuration
 */
export const globalUsersReportConfig: ReportConfig<GlobalUsersReport> = {
	id: "global-users",
	name: "Users Report",
	description:
		"A comprehensive list of all users with their roles, session counts, and account information",
	icon: UsersIcon,
	permissions: [GLOBAL_REPORTS_PERMISSION],
	requiresPeriod: false,
	filters: [
		{
			id: "filterRoles",
			type: "multi-select",
			label: "Filter by Roles",
			description: "Only include users with any of the selected roles",
			required: false,
		},
	],
	getColumns: (): ColumnDef<GlobalUsersReport, unknown>[] => [
		{
			accessorKey: "name",
			header: "Name",
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
			accessorKey: "roles",
			header: "Roles",
			cell: ({ row }) => row.original.roles || "—",
		},
		{
			accessorKey: "totalSessions",
			header: "Total Sessions",
			cell: ({ row }) => row.original.totalSessions,
		},
		{
			accessorKey: "createdAt",
			header: "Created",
			cell: ({ row }) => formatDate(row.original.createdAt),
		},
	],
	exportFormats: DEFAULT_EXPORT_FORMATS,
};

/**
 * Global Sessions Report Configuration
 */
export const globalSessionsReportConfig: ReportConfig<GlobalSessionsReport> = {
	id: "global-sessions",
	name: "Sessions Report",
	description:
		"A detailed list of all sessions with user information and duration",
	icon: FileClockIcon,
	permissions: [GLOBAL_REPORTS_PERMISSION],
	requiresPeriod: false,
	filters: [
		{
			id: "dateRange",
			type: "date-range",
			label: "Date Range",
			description: "Filter sessions within a specific date range",
			required: false,
		},
		{
			id: "sessionType",
			type: "select",
			label: "Session Type",
			description: "Filter by session type",
			required: false,
			options: [
				{ value: "regular", label: "Regular" },
				{ value: "staffing", label: "Staffing" },
			],
		},
		{
			id: "includeOngoing",
			type: "checkbox",
			label: "Include Ongoing Sessions",
			description: "Include sessions that have not ended yet",
			required: false,
			defaultValue: true,
		},
	],
	getColumns: (): ColumnDef<GlobalSessionsReport, unknown>[] => [
		{
			accessorKey: "userName",
			header: "User",
			cell: ({ row }) => row.original.userName,
		},
		{
			accessorKey: "username",
			header: "Username",
			cell: ({ row }) => row.original.username,
		},
		{
			accessorKey: "sessionType",
			header: "Type",
			cell: ({ row }) =>
				row.original.sessionType === "staffing" ? "Staffing" : "Regular",
		},
		{
			accessorKey: "startedAt",
			header: "Started",
			cell: ({ row }) => formatDate(row.original.startedAt),
		},
		{
			accessorKey: "endedAt",
			header: "Ended",
			cell: ({ row }) =>
				row.original.isOngoing ? "Ongoing" : formatDate(row.original.endedAt),
		},
		{
			accessorKey: "durationMinutes",
			header: "Duration",
			cell: ({ row }) => {
				if (row.original.isOngoing) return "—";
				const hours = row.original.durationMinutes / 60;
				return formatHours(hours);
			},
		},
	],
	exportFormats: DEFAULT_EXPORT_FORMATS,
};

/**
 * Global User Sessions Report Configuration (Aggregate)
 */
export const globalUserSessionsReportConfig: ReportConfig<GlobalUserSessionsReport> =
	{
		id: "global-user-sessions",
		name: "User Sessions Summary",
		description:
			"Aggregate session statistics per user including total hours and session counts",
		icon: ClipboardListIcon,
		permissions: [GLOBAL_REPORTS_PERMISSION],
		requiresPeriod: false,
		filters: [
			{
				id: "dateRange",
				type: "date-range",
				label: "Date Range",
				description: "Filter sessions within a specific date range",
				required: false,
			},
			{
				id: "sessionType",
				type: "select",
				label: "Session Type",
				description: "Filter by session type",
				required: false,
				options: [
					{ value: "regular", label: "Regular" },
					{ value: "staffing", label: "Staffing" },
				],
			},
			{
				id: "filterRoles",
				type: "multi-select",
				label: "Filter by Roles",
				description: "Only include users with any of the selected roles",
				required: false,
			},
		],
		getColumns: (): ColumnDef<GlobalUserSessionsReport, unknown>[] => [
			{
				accessorKey: "name",
				header: "Name",
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
				accessorKey: "roles",
				header: "Roles",
				cell: ({ row }) => row.original.roles || "—",
			},
			{
				accessorKey: "totalSessions",
				header: "Total Sessions",
				cell: ({ row }) => row.original.totalSessions,
			},
			{
				accessorKey: "regularSessions",
				header: "Regular",
				cell: ({ row }) => row.original.regularSessions,
			},
			{
				accessorKey: "staffingSessions",
				header: "Staffing",
				cell: ({ row }) => row.original.staffingSessions,
			},
			{
				accessorKey: "totalHours",
				header: "Total Hours",
				cell: ({ row }) => formatHours(row.original.totalHours),
			},
			{
				accessorKey: "averageHours",
				header: "Avg Hours/Session",
				cell: ({ row }) => formatHours(row.original.averageHours),
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
 * All available global report configurations
 */
export const globalReportConfigs: ReportConfig<Record<string, unknown>>[] = [
	globalUsersReportConfig as unknown as ReportConfig<Record<string, unknown>>,
	globalSessionsReportConfig as unknown as ReportConfig<
		Record<string, unknown>
	>,
	globalUserSessionsReportConfig as unknown as ReportConfig<
		Record<string, unknown>
	>,
];

/**
 * Get a global report configuration by ID
 */
export function getGlobalReportConfig(
	reportId: string,
): ReportConfig<Record<string, unknown>> | undefined {
	return globalReportConfigs.find((config) => config.id === reportId);
}
