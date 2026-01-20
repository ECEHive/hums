import type { ColumnDef } from "@tanstack/react-table";
import type { LucideIcon } from "lucide-react";

/**
 * Report field definition for configuring columns and data
 */
export interface ReportField<T = unknown> {
	key: string;
	label: string;
	description?: string;
	sortable?: boolean;
	filterable?: boolean;
	// For formatting display values
	format?: (value: T) => string;
	// For CSV export - raw value or formatted
	exportFormat?: (value: T) => string;
}

/**
 * Report filter configuration
 */
export interface ReportFilter {
	id: string;
	type: "date-range" | "select" | "multi-select" | "checkbox" | "number-range";
	label: string;
	description?: string;
	required?: boolean;
	defaultValue?: unknown;
	options?: { value: string | number; label: string }[];
}

/**
 * Date range preset configuration
 */
export interface DateRangePreset {
	id: string;
	label: string;
	getRange: () => { start: Date; end: Date };
}

/**
 * Export format type
 */
export type ExportFormat = "csv" | "html";

/**
 * Base report configuration
 */
export interface ReportConfig<TData = Record<string, unknown>> {
	id: string;
	name: string;
	description: string;
	icon: LucideIcon;
	permissions: string[];
	// Filter configuration
	filters: ReportFilter[];
	dateRangePresets?: DateRangePreset[];
	// Whether this report requires a period selection
	requiresPeriod?: boolean;
	// Column definitions for the data table
	getColumns: () => ColumnDef<TData, unknown>[];
	// Available export formats
	exportFormats: ExportFormat[];
}

/**
 * Report data response from the server
 */
export interface ReportDataResponse<TData = Record<string, unknown>> {
	data: TData[];
	total: number;
	metadata?: Record<string, unknown>;
}

/**
 * Report generation parameters
 */
export interface ReportParams {
	reportId: string;
	periodId?: number;
	startDate?: Date;
	endDate?: Date;
	filters?: Record<string, unknown>;
}

/**
 * User attendance report data
 */
export interface UserAttendanceReport {
	id: number;
	name: string;
	username: string;
	periodScheduledTime: number;
	pastScheduledTime: number;
	pastAttendedTime: number;
	pastMissedTime: number;
	pastAttendancePercentage: number;
}

/**
 * Shift schedule export data
 */
export interface ScheduleExportData {
	timeSlot: string;
	dayOfWeek: number;
	startTime: string;
	endTime: string;
	shiftTypeName: string;
	shiftTypeLocation?: string;
	users: { id: number; name: string }[];
}

/**
 * Session activity report data
 */
export interface SessionActivityReport {
	id: number;
	name: string;
	username: string;
	totalSessions: number;
	totalDuration: number;
	averageSessionDuration: number;
	lastSessionDate: Date | null;
}

/**
 * Shift coverage report data
 */
export interface ShiftCoverageReport {
	shiftTypeId: number;
	shiftTypeName: string;
	shiftTypeLocation: string;
	totalSlots: number;
	filledSlots: number;
	coveragePercentage: number;
	dayOfWeek: number;
	timeSlot: string;
}

/**
 * User schedule summary report data
 */
export interface UserScheduleSummary {
	id: number;
	name: string;
	username: string;
	email: string;
	totalScheduledHours: number;
	shiftsPerWeek: number;
	shiftTypes: string[];
	daysScheduled: string[];
}
