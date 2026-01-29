import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
	ChevronRight,
	DownloadIcon,
	Filter,
	Loader2,
	Printer,
	RefreshCwIcon,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useCurrentUser } from "@/auth/AuthProvider";
import { MissingPermissions } from "@/components/guards/missing-permissions";
import { RequirePermissions } from "@/components/guards/require-permissions";
import {
	Page,
	PageContent,
	PageDescription,
	PageHeader,
	PageTitle,
	TableContainer,
} from "@/components/layout";
import type { Role } from "@/components/roles/role-multiselect";
import { RoleMultiSelect } from "@/components/roles/role-multiselect";
import { DataTable } from "@/components/shared";
import DateRangeSelector from "@/components/shared/date-range-selector";
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { checkPermissions, type RequiredPermissions } from "@/lib/permissions";
import {
	GLOBAL_REPORTS_PERMISSION,
	globalReportConfigs,
} from "@/lib/reports/global-configs";
import { columnsToExportFormat, exportReport } from "@/lib/reports/export";
import type { ReportConfig } from "@/lib/reports/types";

export const Route = createFileRoute("/app/_app/reports")({
	component: () =>
		RequirePermissions({
			permissions,
			children: <GlobalReportsPage />,
			forbiddenFallback: <MissingPermissions />,
		}),
});

export const permissions = [GLOBAL_REPORTS_PERMISSION] as RequiredPermissions;

/**
 * Get standard date presets for global reports
 */
function getGlobalDatePresets() {
	const now = new Date();
	const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const startOfWeek = new Date(startOfToday);
	startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());
	const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
	const startOfYear = new Date(now.getFullYear(), 0, 1);
	const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
	const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

	return [
		{
			id: "today",
			label: "Today",
			getRange: () => ({
				start: startOfToday,
				end: new Date(startOfToday.getTime() + 86400000 - 1),
			}),
		},
		{
			id: "thisweek",
			label: "This Week",
			getRange: () => ({ start: startOfWeek, end: now }),
		},
		{
			id: "thismonth",
			label: "This Month",
			getRange: () => ({ start: startOfMonth, end: now }),
		},
		{
			id: "lastmonth",
			label: "Last Month",
			getRange: () => ({ start: startOfLastMonth, end: endOfLastMonth }),
		},
		{
			id: "thisyear",
			label: "This Year",
			getRange: () => ({ start: startOfYear, end: now }),
		},
		{
			id: "alltime",
			label: "All Time",
			getRange: () => ({ start: new Date(2000, 0, 1), end: now }),
		},
	];
}

function GlobalReportsPage() {
	const currentUser = useCurrentUser();

	// Report type selection
	const [selectedReportId, setSelectedReportId] =
		useState<string>("global-users");

	// Date range state
	const [startDate, setStartDate] = useState<Date | null>(null);
	const [endDate, setEndDate] = useState<Date | null>(null);
	const [selectedRange, setSelectedRange] = useState<string>("alltime");

	// Filter states
	const [selectedRoles, setSelectedRoles] = useState<Role[]>([]);
	const [sessionType, setSessionType] = useState<string | null>(null);
	const [includeOngoing, setIncludeOngoing] = useState(true);

	// Track if report has been generated
	const [hasGenerated, setHasGenerated] = useState(false);

	// Get the current report config
	const currentReportConfig = globalReportConfigs.find(
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
		() => globalReportConfigs.filter((config) => canViewReport(config)),
		[canViewReport],
	);

	// Date presets
	const datePresets = useMemo(() => getGlobalDatePresets(), []);

	// Build query params based on report type
	const reportParams = useMemo(() => {
		switch (selectedReportId) {
			case "global-users":
				return {
					filterRoleIds:
						selectedRoles.length > 0
							? selectedRoles.map((r) => r.id)
							: undefined,
				};
			case "global-sessions":
				return {
					startDate: startDate?.toISOString(),
					endDate: endDate?.toISOString(),
					sessionType: sessionType ?? undefined,
					includeOngoing,
				};
			case "global-user-sessions":
				return {
					startDate: startDate?.toISOString(),
					endDate: endDate?.toISOString(),
					sessionType: sessionType ?? undefined,
					filterRoleIds:
						selectedRoles.length > 0
							? selectedRoles.map((r) => r.id)
							: undefined,
				};
			default:
				return {};
		}
	}, [
		selectedReportId,
		selectedRoles,
		startDate,
		endDate,
		sessionType,
		includeOngoing,
	]);

	// Users Report query
	const {
		data: usersData,
		isLoading: usersLoading,
		refetch: refetchUsers,
	} = useQuery({
		queryKey: ["globalReports.usersReport", reportParams],
		queryFn: () =>
			trpc.globalReports.usersReport.query(
				reportParams as Parameters<
					typeof trpc.globalReports.usersReport.query
				>[0],
			),
		enabled: false,
	});

	// Sessions Report query
	const {
		data: sessionsData,
		isLoading: sessionsLoading,
		refetch: refetchSessions,
	} = useQuery({
		queryKey: ["globalReports.sessionsReport", reportParams],
		queryFn: () =>
			trpc.globalReports.sessionsReport.query(
				reportParams as Parameters<
					typeof trpc.globalReports.sessionsReport.query
				>[0],
			),
		enabled: false,
	});

	// User Sessions Report query
	const {
		data: userSessionsData,
		isLoading: userSessionsLoading,
		refetch: refetchUserSessions,
	} = useQuery({
		queryKey: ["globalReports.userSessionsReport", reportParams],
		queryFn: () =>
			trpc.globalReports.userSessionsReport.query(
				reportParams as Parameters<
					typeof trpc.globalReports.userSessionsReport.query
				>[0],
			),
		enabled: false,
	});

	// Determine current loading state
	const isLoading = useMemo(() => {
		switch (selectedReportId) {
			case "global-users":
				return usersLoading;
			case "global-sessions":
				return sessionsLoading;
			case "global-user-sessions":
				return userSessionsLoading;
			default:
				return false;
		}
	}, [selectedReportId, usersLoading, sessionsLoading, userSessionsLoading]);

	// Get current report data
	const reportData = useMemo(() => {
		switch (selectedReportId) {
			case "global-users":
				return usersData?.reports ?? [];
			case "global-sessions":
				return sessionsData?.reports ?? [];
			case "global-user-sessions":
				return userSessionsData?.reports ?? [];
			default:
				return [];
		}
	}, [selectedReportId, usersData, sessionsData, userSessionsData]);

	// Get columns for current report type
	const currentColumns = useMemo(() => {
		return currentReportConfig?.getColumns() ?? [];
	}, [currentReportConfig]);

	// Handle report generation
	const handleGenerateReport = useCallback(async () => {
		setHasGenerated(true);

		switch (selectedReportId) {
			case "global-users":
				await refetchUsers();
				break;
			case "global-sessions":
				await refetchSessions();
				break;
			case "global-user-sessions":
				await refetchUserSessions();
				break;
		}
	}, [selectedReportId, refetchUsers, refetchSessions, refetchUserSessions]);

	// Handle CSV export
	const handleExportCSV = useCallback(() => {
		if (!reportData || reportData.length === 0) return;

		const columns = columnsToExportFormat(currentColumns);
		const filename =
			currentReportConfig?.name.toLowerCase().replace(/ /g, "-") ?? "report";

		exportReport("csv", reportData as Record<string, unknown>[], {
			filename,
			title: currentReportConfig?.name ?? "Report",
			subtitle: "Global Report",
			columns,
		});
	}, [reportData, currentColumns, currentReportConfig]);

	// Handle HTML/Print export
	const handleExportHTML = useCallback(() => {
		if (!reportData || reportData.length === 0) return;

		const columns = columnsToExportFormat(currentColumns);
		const filename =
			currentReportConfig?.name.toLowerCase().replace(/ /g, "-") ?? "report";

		exportReport("html", reportData as Record<string, unknown>[], {
			filename,
			title: currentReportConfig?.name ?? "Report",
			subtitle: "Global Report",
			columns,
		});
	}, [reportData, currentColumns, currentReportConfig]);

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

	// Check if current report needs date range
	const needsDateRange = useMemo(() => {
		return ["global-sessions", "global-user-sessions"].includes(
			selectedReportId,
		);
	}, [selectedReportId]);

	// Check if current report needs role filter
	const needsRoleFilter = useMemo(() => {
		return ["global-users", "global-user-sessions"].includes(selectedReportId);
	}, [selectedReportId]);

	// Check if current report needs session type filter
	const needsSessionTypeFilter = useMemo(() => {
		return ["global-sessions", "global-user-sessions"].includes(
			selectedReportId,
		);
	}, [selectedReportId]);

	return (
		<Page>
			<PageHeader>
				<div>
					<PageTitle>Global Reports</PageTitle>
					<PageDescription>
						Generate and export system-wide reports for users and sessions
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

						{/* Date Range Selection (for session-related reports) */}
						{needsDateRange && (
							<div className="space-y-4">
								<div className="space-y-2">
									<Label>Preset Date Ranges</Label>
									<ToggleGroup
										variant="outline"
										type="single"
										value={selectedRange}
										onValueChange={(value) => value && applyPreset(value)}
										className="flex-wrap justify-start"
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

						{/* Session Type Selection */}
						{needsSessionTypeFilter && (
							<div className="space-y-2">
								<Label>Session Type</Label>
								<Select
									value={sessionType ?? "all"}
									onValueChange={(value) => {
										setSessionType(value === "all" ? null : value);
									}}
								>
									<SelectTrigger className="w-full md:w-[200px]">
										<SelectValue placeholder="All Types" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">All Types</SelectItem>
										<SelectItem value="regular">Regular</SelectItem>
										<SelectItem value="staffing">Staffing</SelectItem>
									</SelectContent>
								</Select>
							</div>
						)}

						{/* Role Filter (for user-related reports) */}
						{needsRoleFilter && (
							<div className="space-y-2">
								<Label>Filter by Roles (optional)</Label>
								<RoleMultiSelect
									value={selectedRoles}
									onChange={setSelectedRoles}
									placeholder="All roles (click to filter)"
								/>
								<p className="text-sm text-muted-foreground">
									{selectedRoles.length === 0
										? "All users will be included"
										: `${selectedRoles.length} role${selectedRoles.length === 1 ? "" : "s"} selected`}
								</p>
							</div>
						)}

						{/* Include Ongoing Sessions checkbox */}
						{selectedReportId === "global-sessions" && (
							<div className="flex items-center space-x-2">
								<Checkbox
									id="includeOngoing"
									checked={includeOngoing}
									onCheckedChange={(checked) =>
										setIncludeOngoing(checked === true)
									}
								/>
								<Label
									htmlFor="includeOngoing"
									className="text-sm font-normal cursor-pointer"
								>
									Include ongoing sessions
								</Label>
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

				{/* Results Table */}
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
