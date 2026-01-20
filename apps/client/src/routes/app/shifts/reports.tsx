import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
	AlertTriangle,
	Calendar,
	ChevronRight,
	DownloadIcon,
	Filter,
	Loader2,
	Printer,
	RefreshCwIcon,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useCurrentUser } from "@/auth/AuthProvider";
import { RequirePermissions } from "@/components/guards/require-permissions";
import {
	Page,
	PageContent,
	PageDescription,
	PageHeader,
	PageTitle,
	TableContainer,
} from "@/components/layout";
import { usePeriod } from "@/components/providers/period-provider";
import { DataTable } from "@/components/shared";
import DateRangeSelector from "@/components/shared/date-range-selector";
import {
	type ShiftType,
	ShiftTypeMultiselect,
} from "@/components/shift-types/shift-type-multiselect";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { checkPermissions, type RequiredPermissions } from "@/lib/permissions";
import { reportConfigs } from "@/lib/reports/configs";
import { columnsToExportFormat, exportReport } from "@/lib/reports/export";
import type { ReportConfig } from "@/lib/reports/types";
import {
	compareTimeSlots,
	DAYS_OF_WEEK,
	formatTimeSlot,
	getStandardDatePresets,
} from "@/lib/reports/utils";

export const Route = createFileRoute("/app/shifts/reports")({
	component: () => (
		<RequirePermissions permissions={permissions}>
			<ReportsPage />
		</RequirePermissions>
	),
});

export const permissions = ["period.reports"] as RequiredPermissions;

/**
 * Transform schedule export data into a flat table format for display
 */
function transformScheduleExportData(
	exportData: {
		schedules: Array<{
			dayOfWeek: number;
			startTime: string;
			endTime: string;
			shiftType: { id: number; name: string; location: string | null };
			users: Array<{ id: number; name: string }>;
		}>;
		shiftTypes: Array<{ id: number; name: string; location: string | null }>;
		period: { id: number; name: string };
	},
	selectedShiftTypeIds: number[],
): Record<string, unknown>[] {
	const { schedules, shiftTypes } = exportData;

	// Get the shift types to display
	const displayShiftTypes =
		selectedShiftTypeIds.length > 0
			? shiftTypes.filter((st) => selectedShiftTypeIds.includes(st.id))
			: shiftTypes;

	// Group schedules by time slot
	const timeSlotMap = new Map<
		string,
		{
			dayOfWeek: number;
			startTime: string;
			data: Map<number, { users: { id: number; name: string }[] }>;
		}
	>();

	for (const schedule of schedules) {
		const timeKey = formatTimeSlot(
			schedule.dayOfWeek,
			schedule.startTime,
			schedule.endTime,
		);

		if (!timeSlotMap.has(timeKey)) {
			timeSlotMap.set(timeKey, {
				dayOfWeek: schedule.dayOfWeek,
				startTime: schedule.startTime,
				data: new Map(),
			});
		}

		const slot = timeSlotMap.get(timeKey);
		if (slot) {
			if (!slot.data.has(schedule.shiftType.id)) {
				slot.data.set(schedule.shiftType.id, { users: [] });
			}
			const entry = slot.data.get(schedule.shiftType.id);
			if (entry) {
				entry.users.push(...schedule.users);
			}
		}
	}

	// Sort time slots and build rows
	const sortedEntries = Array.from(timeSlotMap.entries()).sort(([, a], [, b]) =>
		compareTimeSlots(a, b),
	);

	return sortedEntries.map(([timeSlot, slot]) => {
		const row: Record<string, unknown> = {
			timeSlot,
			dayOfWeek: slot.dayOfWeek,
			startTime: slot.startTime,
		};

		// Add columns for each shift type
		for (const st of displayShiftTypes) {
			const users = slot.data.get(st.id)?.users ?? [];
			row[`shiftType_${st.id}`] = users.map((u) => u.name).join(", ") || "";
		}

		return row;
	});
}

function ReportsPage() {
	const { period: selectedPeriodId } = usePeriod();
	const currentUser = useCurrentUser();

	// Report type selection
	const [selectedReportId, setSelectedReportId] =
		useState<string>("user-attendance");

	// Date range state
	const [startDate, setStartDate] = useState<Date | null>(null);
	const [endDate, setEndDate] = useState<Date | null>(null);
	const [selectedRange, setSelectedRange] = useState<string>("fullperiod");

	// Filter states
	const [selectedShiftTypes, setSelectedShiftTypes] = useState<ShiftType[]>([]);
	const [selectedDays, setSelectedDays] = useState<number[]>([
		0, 1, 2, 3, 4, 5, 6,
	]);
	// Shift Users specific filters
	const [selectedDayOfWeek, setSelectedDayOfWeek] = useState<number | null>(
		null,
	);
	const [filterStartTime, setFilterStartTime] = useState<string>("");
	const [filterEndTime, setFilterEndTime] = useState<string>("");

	// Track if report has been generated
	const [hasGenerated, setHasGenerated] = useState(false);

	// Get period data
	const { data: periodData, isLoading: periodLoading } = useQuery({
		queryKey: ["period", Number(selectedPeriodId)],
		queryFn: async () => {
			if (!selectedPeriodId) return null;
			const res = await trpc.periods.get.query({
				id: Number(selectedPeriodId),
			});
			// Initialize dates from period
			if (res?.period) {
				setStartDate(res.period.start);
				setEndDate(res.period.end);
			}
			return res;
		},
		enabled: selectedPeriodId !== null,
	});

	// Get the current report config
	const currentReportConfig = reportConfigs.find(
		(r) => r.id === selectedReportId,
	);

	// Check permissions for each report
	const canViewReport = useCallback(
		(config: ReportConfig<Record<string, unknown>>) => {
			return checkPermissions(currentUser, config.permissions);
		},
		[currentUser],
	);

	// Available reports for this user
	const availableReports = useMemo(
		() => reportConfigs.filter((config) => canViewReport(config)),
		[canViewReport],
	);

	// Date presets
	const datePresets = useMemo(() => {
		return getStandardDatePresets(
			periodData?.period?.start,
			periodData?.period?.end,
			periodData?.period?.name,
		);
	}, [periodData?.period]);

	// Staffing roles from period
	const staffingRoles = useMemo(
		() => periodData?.period?.roles?.map((role) => role.id) ?? null,
		[periodData?.period?.roles],
	);

	// Build query params based on report type
	const reportParams = useMemo(() => {
		const base = {
			startDate: startDate?.toISOString(),
			endDate: endDate?.toISOString(),
			periodId: Number(selectedPeriodId),
		};

		switch (selectedReportId) {
			case "user-attendance":
				return {
					...base,
					staffingRoleIds: staffingRoles ?? undefined,
				};
			case "session-activity":
				return {
					startDate: startDate?.toISOString(),
					endDate: endDate?.toISOString(),
				};
			case "shift-coverage":
			case "schedule-export":
				return {
					periodId: Number(selectedPeriodId),
					shiftTypeIds:
						selectedShiftTypes.length > 0
							? selectedShiftTypes.map((st) => st.id)
							: undefined,
					daysOfWeek: selectedDays.length < 7 ? selectedDays : undefined,
				};
			case "user-schedule-summary":
				return {
					periodId: Number(selectedPeriodId),
					shiftTypeIds:
						selectedShiftTypes.length > 0
							? selectedShiftTypes.map((st) => st.id)
							: undefined,
				};
			case "shift-users":
				return {
					periodId: Number(selectedPeriodId),
					shiftTypeIds:
						selectedShiftTypes.length > 0
							? selectedShiftTypes.map((st) => st.id)
							: undefined,
					dayOfWeek:
						selectedDayOfWeek !== null && selectedDayOfWeek >= 0
							? selectedDayOfWeek
							: undefined,
					startTime: filterStartTime || undefined,
					endTime: filterEndTime || undefined,
				};
			default:
				return base;
		}
	}, [
		selectedReportId,
		startDate,
		endDate,
		selectedPeriodId,
		staffingRoles,
		selectedShiftTypes,
		selectedDays,
		selectedDayOfWeek,
		filterStartTime,
		filterEndTime,
	]);

	// User Attendance Report query
	const {
		data: attendanceData,
		isLoading: attendanceLoading,
		refetch: refetchAttendance,
	} = useQuery({
		queryKey: ["reports.generate", reportParams],
		queryFn: () =>
			trpc.reports.generate.query(
				reportParams as Parameters<typeof trpc.reports.generate.query>[0],
			),
		enabled: false,
	});

	// Session Activity Report query
	const {
		data: sessionData,
		isLoading: sessionLoading,
		refetch: refetchSession,
	} = useQuery({
		queryKey: ["reports.sessionActivity", reportParams],
		queryFn: () =>
			trpc.reports.sessionActivity.query(
				reportParams as Parameters<
					typeof trpc.reports.sessionActivity.query
				>[0],
			),
		enabled: false,
	});

	// Shift Coverage Report query
	const {
		data: coverageData,
		isLoading: coverageLoading,
		refetch: refetchCoverage,
	} = useQuery({
		queryKey: ["reports.shiftCoverage", reportParams],
		queryFn: () =>
			trpc.reports.shiftCoverage.query(
				reportParams as Parameters<typeof trpc.reports.shiftCoverage.query>[0],
			),
		enabled: false,
	});

	// User Schedule Summary Report query
	const {
		data: summaryData,
		isLoading: summaryLoading,
		refetch: refetchSummary,
	} = useQuery({
		queryKey: ["reports.userScheduleSummary", reportParams],
		queryFn: () =>
			trpc.reports.userScheduleSummary.query(
				reportParams as Parameters<
					typeof trpc.reports.userScheduleSummary.query
				>[0],
			),
		enabled: false,
	});

	// Schedule Export query
	const {
		data: exportData,
		isLoading: exportLoading,
		refetch: refetchExport,
	} = useQuery({
		queryKey: ["shiftSchedules.listForExport", reportParams],
		queryFn: () =>
			trpc.shiftSchedules.listForExport.query(
				reportParams as Parameters<
					typeof trpc.shiftSchedules.listForExport.query
				>[0],
			),
		enabled: false,
	});

	// Shift Users Report query
	const {
		data: shiftUsersData,
		isLoading: shiftUsersLoading,
		refetch: refetchShiftUsers,
	} = useQuery({
		queryKey: ["reports.shiftUsers", reportParams],
		queryFn: () =>
			trpc.reports.shiftUsers.query(
				reportParams as Parameters<typeof trpc.reports.shiftUsers.query>[0],
			),
		enabled: false,
	});

	// Determine current loading state
	const isLoading = useMemo(() => {
		switch (selectedReportId) {
			case "user-attendance":
				return attendanceLoading;
			case "session-activity":
				return sessionLoading;
			case "shift-coverage":
				return coverageLoading;
			case "user-schedule-summary":
				return summaryLoading;
			case "schedule-export":
				return exportLoading;
			case "shift-users":
				return shiftUsersLoading;
			default:
				return false;
		}
	}, [
		selectedReportId,
		attendanceLoading,
		sessionLoading,
		coverageLoading,
		summaryLoading,
		exportLoading,
		shiftUsersLoading,
	]);

	// Get current report data
	const reportData = useMemo(() => {
		switch (selectedReportId) {
			case "user-attendance":
				return attendanceData?.reports ?? [];
			case "session-activity":
				return sessionData?.reports ?? [];
			case "shift-coverage":
				return coverageData?.reports ?? [];
			case "user-schedule-summary":
				return summaryData?.reports ?? [];
			case "shift-users":
				return shiftUsersData?.reports ?? [];
			case "schedule-export":
				// Transform schedule export data into table rows
				if (!exportData) return [];
				return transformScheduleExportData(
					exportData,
					selectedShiftTypes.map((st) => st.id),
				);
			default:
				return [];
		}
	}, [
		selectedReportId,
		attendanceData,
		sessionData,
		coverageData,
		summaryData,
		shiftUsersData,
		exportData,
		selectedShiftTypes,
	]);

	// Get display shift types for schedule export
	const displayShiftTypes = useMemo(() => {
		if (!exportData) return [];
		const selectedIds = selectedShiftTypes.map((st) => st.id);
		return selectedIds.length > 0
			? exportData.shiftTypes.filter((st) => selectedIds.includes(st.id))
			: exportData.shiftTypes;
	}, [exportData, selectedShiftTypes]);

	// Dynamic columns for schedule export
	const scheduleExportColumns = useMemo(() => {
		const baseColumns = [
			{
				accessorKey: "timeSlot" as const,
				header: "Day & Time",
				cell: ({
					row,
				}: { row: { original: Record<string, unknown> } }) =>
					row.original.timeSlot as string,
			},
		];
		const shiftTypeColumns = displayShiftTypes.map((st) => ({
			accessorKey: `shiftType_${st.id}` as string,
			header: st.location ? `${st.name} (${st.location})` : st.name,
			cell: ({ row }: { row: { original: Record<string, unknown> } }) => {
				const users = row.original[`shiftType_${st.id}`] as string;
				return users || "—";
			},
		}));
		return [...baseColumns, ...shiftTypeColumns];
	}, [displayShiftTypes]);

	// Get columns for current report type (cast to the expected type for DataTable)
	const currentColumns = useMemo(() => {
		if (selectedReportId === "schedule-export") {
			return scheduleExportColumns as unknown as ReturnType<
				ReportConfig<Record<string, unknown>>["getColumns"]
			>;
		}
		return currentReportConfig?.getColumns() ?? [];
	}, [selectedReportId, scheduleExportColumns, currentReportConfig]);

	// Handle report generation
	const handleGenerateReport = useCallback(async () => {
		setHasGenerated(true);

		switch (selectedReportId) {
			case "user-attendance":
				await refetchAttendance();
				break;
			case "session-activity":
				await refetchSession();
				break;
			case "shift-coverage":
				await refetchCoverage();
				break;
			case "user-schedule-summary":
				await refetchSummary();
				break;
			case "schedule-export":
				await refetchExport();
				break;
			case "shift-users":
				await refetchShiftUsers();
				break;
		}
	}, [
		selectedReportId,
		refetchAttendance,
		refetchSession,
		refetchCoverage,
		refetchSummary,
		refetchExport,
		refetchShiftUsers,
	]);

	// Handle CSV export (unified for all reports)
	const handleExportCSV = useCallback(() => {
		if (!reportData || reportData.length === 0) return;

		const columns = columnsToExportFormat(currentColumns);
		const filename =
			selectedReportId === "schedule-export"
				? `schedule-export-${exportData?.period.name ?? "export"}`
				: (currentReportConfig?.name.toLowerCase().replace(/ /g, "-") ??
					"report");

		exportReport("csv", reportData as Record<string, unknown>[], {
			filename,
			title:
				selectedReportId === "schedule-export"
					? `Schedule Export - ${exportData?.period.name ?? "Export"}`
					: (currentReportConfig?.name ?? "Report"),
			subtitle: periodData?.period?.name ?? "Report",
			columns,
		});
	}, [
		reportData,
		currentColumns,
		currentReportConfig,
		periodData?.period?.name,
		selectedReportId,
		exportData?.period.name,
	]);

	// Handle HTML/Print export (unified for all reports)
	const handleExportHTML = useCallback(() => {
		if (!reportData || reportData.length === 0) return;

		const columns = columnsToExportFormat(currentColumns);
		const filename =
			selectedReportId === "schedule-export"
				? `schedule-export-${exportData?.period.name ?? "export"}`
				: (currentReportConfig?.name.toLowerCase().replace(/ /g, "-") ??
					"report");

		exportReport("html", reportData as Record<string, unknown>[], {
			filename,
			title:
				selectedReportId === "schedule-export"
					? `Schedule Export - ${exportData?.period.name ?? "Export"}`
					: (currentReportConfig?.name ?? "Report"),
			subtitle: periodData?.period?.name ?? "Report",
			columns,
		});
	}, [
		reportData,
		currentColumns,
		currentReportConfig,
		periodData?.period?.name,
		selectedReportId,
		exportData?.period.name,
	]);

	// Toggle day selection
	const toggleDay = useCallback((day: number) => {
		setSelectedDays((prev) =>
			prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
		);
	}, []);

	// Apply date preset
	const applyPreset = useCallback(
		(presetId: string) => {
			const preset = datePresets.find((p) => p.id === presetId);
			if (preset) {
				const range = preset.getRange();
				setStartDate(range.start);
				setEndDate(range.end);
				setSelectedRange(presetId);
			}
		},
		[datePresets],
	);

	// No period selected (for reports that require it)
	const requiresPeriod = currentReportConfig?.requiresPeriod ?? false;
	if (requiresPeriod && selectedPeriodId === null) {
		return (
			<Page>
				<PageHeader>
					<div>
						<PageTitle>Reports</PageTitle>
						<PageDescription>
							Generate and export various reports for your organization
						</PageDescription>
					</div>
				</PageHeader>
				<PageContent>
					<Card>
						<CardContent className="flex flex-col items-center justify-center py-12">
							<Calendar className="h-12 w-12 text-muted-foreground mb-4" />
							<p className="text-muted-foreground text-center">
								Please select a period from the sidebar to generate reports
							</p>
						</CardContent>
					</Card>
				</PageContent>
			</Page>
		);
	}

	return (
		<Page>
			<PageHeader>
				<div>
					<PageTitle>Reports</PageTitle>
					<PageDescription>
						Generate and export various reports for your organization
					</PageDescription>
				</div>
			</PageHeader>

			<PageContent>
				{/* Report Selection Card */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2 text-base">
							<Filter className="h-4 w-4" />
							Report Configuration
						</CardTitle>
						<CardDescription>
							Select a report type and configure the parameters
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-6">
						{/* Report Type Selection */}
						<div className="space-y-2">
							<Label>Report Type</Label>
							<Select
								value={selectedReportId}
								onValueChange={(value) => {
									setSelectedReportId(value);
									setHasGenerated(false);
								}}
							>
								<SelectTrigger className="w-full md:w-[400px]">
									<SelectValue placeholder="Select a report type" />
								</SelectTrigger>
								<SelectContent>
									{availableReports.map((config) => (
										<SelectItem key={config.id} value={config.id}>
											<div className="flex items-center gap-2">
												<config.icon className="h-4 w-4" />
												<span>{config.name}</span>
											</div>
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							{currentReportConfig && (
								<p className="text-sm text-muted-foreground">
									{currentReportConfig.description}
								</p>
							)}
						</div>

						{/* Date Range Selection (for reports that need it) */}
						{(selectedReportId === "user-attendance" ||
							selectedReportId === "session-activity") && (
							<div className="space-y-4">
								<div className="space-y-2">
									<Label>Preset Date Ranges</Label>
									<ToggleGroup
										variant="outline"
										type="single"
										value={selectedRange}
										onValueChange={(value) => value && applyPreset(value)}
									>
										{datePresets.map((preset) => (
											<ToggleGroupItem key={preset.id} value={preset.id}>
												{preset.label}
											</ToggleGroupItem>
										))}
									</ToggleGroup>
								</div>
								<DateRangeSelector
									value={[startDate ?? undefined, endDate ?? undefined]}
									onChange={([s, e]) => {
										setStartDate(s ?? null);
										setEndDate(e ?? null);
										setSelectedRange("custom");
									}}
									withTime={false}
									label="Date Range"
								/>
							</div>
						)}

						{/* Staffing Roles Display (for user attendance) */}
						{selectedReportId === "user-attendance" && (
							<div className="space-y-2">
								<Label>Staffing Roles</Label>
								{periodLoading ? (
									<Spinner />
								) : staffingRoles && staffingRoles.length > 0 ? (
									<div className="flex flex-wrap gap-2">
										{staffingRoles.map((id) => {
											const roleName =
												periodData?.period?.roles?.find((r) => r.id === id)
													?.name ?? `Role ${id}`;
											return (
												<Badge key={id} variant="secondary">
													{roleName}
												</Badge>
											);
										})}
									</div>
								) : (
									<p className="text-sm text-muted-foreground flex items-center gap-1">
										<AlertTriangle className="h-4 w-4" />
										No staffing roles defined for this period. Returning all
										users.
									</p>
								)}
							</div>
						)}

						{/* Shift Type Selection (for shift-related reports) */}
						{(selectedReportId === "shift-coverage" ||
							selectedReportId === "user-schedule-summary" ||
							selectedReportId === "schedule-export" ||
							selectedReportId === "shift-users") &&
							selectedPeriodId && (
								<div className="space-y-2">
									<Label>Shift Types</Label>
									<ShiftTypeMultiselect
										periodId={selectedPeriodId}
										value={selectedShiftTypes}
										onChange={setSelectedShiftTypes}
										placeholder="All shift types (click to filter)"
									/>
									<p className="text-sm text-muted-foreground">
										{selectedShiftTypes.length === 0
											? "All shift types will be included"
											: `${selectedShiftTypes.length} shift type${selectedShiftTypes.length === 1 ? "" : "s"} selected`}
									</p>
								</div>
							)}

						{/* Single Day Selection (for shift-users report) */}
						{selectedReportId === "shift-users" && (
							<div className="space-y-2">
								<Label>Day of Week</Label>
								<Select
									value={
										selectedDayOfWeek !== null
											? String(selectedDayOfWeek)
											: "-1"
									}
									onValueChange={(value) => {
										const v = Number(value);
										setSelectedDayOfWeek(v === -1 ? null : v);
									}}
								>
									<SelectTrigger className="w-full md:w-[200px]">
										<SelectValue placeholder="All Days" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="-1">All Days</SelectItem>
										{DAYS_OF_WEEK.map((day) => (
											<SelectItem key={day.value} value={String(day.value)}>
												{day.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						)}

						{/* Time Range Filter (for shift-users report) */}
						{selectedReportId === "shift-users" && (
							<div className="space-y-2">
								<Label>Time Range (optional)</Label>
								<div className="flex items-center gap-2">
									<input
										type="time"
										value={filterStartTime}
										onChange={(e) => setFilterStartTime(e.target.value)}
										className="flex h-10 w-32 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
										placeholder="Start"
									/>
									<span className="text-muted-foreground">to</span>
									<input
										type="time"
										value={filterEndTime}
										onChange={(e) => setFilterEndTime(e.target.value)}
										className="flex h-10 w-32 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
										placeholder="End"
									/>
									{(filterStartTime || filterEndTime) && (
										<Button
											variant="ghost"
											size="sm"
											onClick={() => {
												setFilterStartTime("");
												setFilterEndTime("");
											}}
										>
											Clear
										</Button>
									)}
								</div>
								<p className="text-sm text-muted-foreground">
									Leave empty to include all times
								</p>
							</div>
						)}

						{/* Day Selection (for schedule-related reports) */}
						{(selectedReportId === "shift-coverage" ||
							selectedReportId === "schedule-export") && (
							<div className="space-y-3">
								<Label>Days of Week</Label>
								<div className="flex flex-wrap gap-3">
									{DAYS_OF_WEEK.map((day) => (
										<div
											key={day.value}
											className="flex items-center space-x-2"
										>
											<Checkbox
												id={`day-${day.value}`}
												checked={selectedDays.includes(day.value)}
												onCheckedChange={() => toggleDay(day.value)}
											/>
											<Label
												htmlFor={`day-${day.value}`}
												className="text-sm font-normal cursor-pointer"
											>
												{day.label}
											</Label>
										</div>
									))}
								</div>
							</div>
						)}

						{/* Generate and Export Buttons */}
						<div className="flex flex-wrap gap-3 pt-4 border-t">
							<Button
								onClick={handleGenerateReport}
								disabled={isLoading}
								className="gap-2"
							>
								{isLoading ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : hasGenerated ? (
									<RefreshCwIcon className="h-4 w-4" />
								) : (
									<ChevronRight className="h-4 w-4" />
								)}
								{hasGenerated ? "Regenerate Report" : "Generate Report"}
							</Button>

							{/* Export buttons - only shown after report is generated */}
							{hasGenerated && reportData.length > 0 && (
								<>
									<Button
										variant="outline"
										onClick={handleExportCSV}
										disabled={isLoading}
										className="gap-2"
									>
										<DownloadIcon className="h-4 w-4" />
										Export CSV
									</Button>
									<Button
										variant="outline"
										onClick={handleExportHTML}
										disabled={isLoading}
										className="gap-2"
									>
										<Printer className="h-4 w-4" />
										Print / PDF
									</Button>
								</>
							)}
						</div>
					</CardContent>
				</Card>

				{/* Results Table - shown for all report types */}
				{hasGenerated && (
					<TableContainer>
						<DataTable
							columns={currentColumns}
							data={reportData}
							isLoading={isLoading}
							emptyMessage="No data found"
							emptyDescription="Try adjusting your filters or date range"
						/>
						{reportData.length > 0 && (
							<div className="flex justify-center py-4">
								<p className="text-sm text-muted-foreground">
									Showing {reportData.length} records
								</p>
							</div>
						)}
					</TableContainer>
				)}
			</PageContent>
		</Page>
	);
}
