import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CircleAlert, DownloadIcon, NotebookTextIcon } from "lucide-react";
import React from "react";
import { RequirePermissions } from "@/auth";
import DateRangeSelector from "@/components/date-range-selector";
import { MissingPermissions } from "@/components/missing-permissions";
import { usePeriod } from "@/components/period-provider";
import { generateColumns } from "@/components/reports/columns";
import { DataTable } from "@/components/reports/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export const Route = createFileRoute("/shifts/reports")({
	component: () =>
		RequirePermissions({
			permissions,
			children: <Reports />,
			forbiddenFallback: <MissingPermissions />,
		}),
});

export const permissions = ["reports.generate"];

function Reports() {
	const [start, setStart] = React.useState<Date | null>(null);
	const [end, setEnd] = React.useState<Date | null>(null);
	const [selectedRange, setSelectedRange] =
		React.useState<string>("fullperiod");
	const [staffingRoles, setStaffingRoles] = React.useState<number[] | null>(
		null,
	);
	const { period: periodId } = usePeriod();

	const reportParams = {
		startDate: start?.toISOString() ?? undefined,
		endDate: end?.toISOString() ?? undefined,
		// use the period-provided staffing roles
		staffingRoleIds: staffingRoles ?? undefined,
		periodId: Number(periodId),
	};

	const { data: periodData, isLoading: periodLoading } = useQuery({
		queryKey: ["period", Number(periodId)],
		queryFn: async () => {
			if (!periodId) return null;
			const res = await trpc.periods.get.query({ id: Number(periodId) });
			setStart(res?.period?.start ?? null);
			setEnd(res?.period?.end ?? null);
			setStaffingRoles(res?.period?.roles.map((role) => role.id) ?? null);
			return res;
		},
	});

	const {
		data: reportData,
		isLoading: reportLoading,
		refetch: refetchReport,
	} = useQuery({
		queryKey: ["reports.generate", reportParams],
		queryFn: async () => {
			// If `staffingRoles` is null or an empty array, reportParams may
			// contain `staffingRoleIds` as `undefined` or `[]`. The server treats
			// both cases as no role filter and will return all users.
			return trpc.reports.generate.query(reportParams);
		},
		retry: false,
		// don't auto-run the query on mount or when params change; only run when the user presses Generate
		enabled: false,
	});

	// Track the params for which a report was last generated so the button
	// can show "Regenerate Report" when the current params match the last generated ones.
	const [lastGeneratedKey, setLastGeneratedKey] = React.useState<string | null>(
		null,
	);
	const currentReportKey = JSON.stringify(reportParams);

	const exportCsv = React.useCallback(() => {
		const rows = (reportData?.reports ?? []) as Record<string, unknown>[];
		if (!rows || rows.length === 0) return;

		const headers = Object.keys(rows[0]);
		const csvEscape = (v: unknown) => {
			if (v === null || v === undefined) return "";
			if (typeof v === "number" || typeof v === "boolean") return String(v);
			const s = String(v);
			return `"${s.replace(/"/g, '""')}"`;
		};

		const csv = [
			headers.join(","),
			...rows.map((r) => headers.map((h) => csvEscape(r[h])).join(",")),
		].join("\n");

		const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		// Format current date/time in the local timezone as YYYY-MM-DD_HH-MM-SS±HHMM
		const now = new Date();
		const pad = (n: number) => String(n).padStart(2, "0");
		const year = now.getFullYear();
		const month = pad(now.getMonth() + 1);
		const day = pad(now.getDate());
		const hours = pad(now.getHours());
		const minutes = pad(now.getMinutes());
		const seconds = pad(now.getSeconds());
		// timezone offset in minutes (getTimezoneOffset returns minutes behind UTC)
		const offsetMin = -now.getTimezoneOffset();
		const offsetSign = offsetMin >= 0 ? "+" : "-";
		const absOffset = Math.abs(offsetMin);
		const offsetHours = pad(Math.floor(absOffset / 60));
		const offsetMinutes = pad(absOffset % 60);
		const tz = `${offsetSign}${offsetHours}${offsetMinutes}`;
		const filename = `report-${year}-${month}-${day}_${hours}-${minutes}-${seconds}${tz}.csv`;
		a.download = filename;
		document.body.appendChild(a);
		a.click();
		setTimeout(() => {
			URL.revokeObjectURL(url);
			document.body.removeChild(a);
		}, 0);
	}, [reportData?.reports]);

	// roles list no longer needed; staffing roles come from the period

	return (
		<div className="container p-4 space-y-4">
			<h1 className="text-2xl font-bold">Reports</h1>

			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<CardTitle className="flex items-center gap-2">
							<NotebookTextIcon className="h-5 w-5" />
							Report Parameters
						</CardTitle>
					</div>
				</CardHeader>
				<CardContent className="space-y-6">
					<div className="inline-flex flex-col w-max gap-4">
						<div>
							<div className="text-sm font-medium mb-3">Preset Date Ranges</div>
							{/* Buttons for common date ranges (last full 2 weeks, last full month, full period) */}
							<div className="flex flex-wrap gap-2">
								<ToggleGroup
									variant="outline"
									type="single"
									value={selectedRange}
									aria-label="Date Ranges"
								>
									<ToggleGroupItem
										value="last2weeks"
										onClick={() => {
											// Calculate last 2 full weeks
											const now = new Date();
											const dayOfWeek = now.getDay(); // 0 (Sun) to 6 (Sat)
											const lastSunday = new Date(
												now.getFullYear(),
												now.getMonth(),
												now.getDate() - dayOfWeek,
											);
											const startOfLast2Weeks = new Date(
												lastSunday.getFullYear(),
												lastSunday.getMonth(),
												lastSunday.getDate() - 14,
											);
											setStart(startOfLast2Weeks);
											setEnd(
												new Date(
													lastSunday.getFullYear(),
													lastSunday.getMonth(),
													lastSunday.getDate() - 1,
												),
											);
											setSelectedRange("last2weeks");
										}}
									>
										Last 2 Full Weeks
									</ToggleGroupItem>
									<ToggleGroupItem
										value="lastmonth"
										onClick={() => {
											const now = new Date();
											const lastDayOfLastMonth = new Date(
												now.getFullYear(),
												now.getMonth(),
												0,
											);
											const firstDayOfLastMonth = new Date(
												now.getFullYear(),
												now.getMonth() - 1,
												1,
											);
											setStart(firstDayOfLastMonth);
											setEnd(lastDayOfLastMonth);
											setSelectedRange("lastmonth");
										}}
									>
										Last Full Month
									</ToggleGroupItem>
									<ToggleGroupItem
										value="fullperiod"
										onClick={() => {
											setSelectedRange("fullperiod");
											if (periodData?.period) {
												setStart(periodData.period.start);
												setEnd(periodData.period.end);
											}
										}}
									>
										{periodLoading || !periodData?.period ? (
											<Spinner />
										) : (
											periodData.period.name
										)}
									</ToggleGroupItem>
								</ToggleGroup>
							</div>
						</div>
						<div>
							<DateRangeSelector
								value={[start ?? undefined, end ?? undefined]}
								onChange={([s, e]) => {
									setStart(s ?? null);
									setEnd(e ?? null);
									setSelectedRange("custom");
								}}
								withTime={false}
								label={"Date Range"}
							/>
						</div>
						<div>
							<div className="text-sm font-medium mb-1">Staffing Roles</div>
							{periodLoading ? (
								<Spinner />
							) : staffingRoles && staffingRoles.length > 0 ? (
								<div className="flex flex-wrap gap-2">
									{staffingRoles.map((id) => {
										const roleName =
											periodData?.period?.roles?.find((r) => r.id === id)
												?.name ?? `Role ${id}`;
										return (
											<Badge
												key={id}
												variant="secondary"
												className="flex items-center gap-1"
											>
												<span>{roleName}</span>
											</Badge>
										);
									})}
								</div>
							) : (
								<div className="text-sm text-muted-foreground">
									<CircleAlert className="inline-block mr-1 h-4 w-4" />
									No staffing roles defined for this period! Returning all
									users.
								</div>
							)}
						</div>
						<div className="pt-2">
							<Button
								variant="default"
								onClick={async () => {
									const result = await refetchReport();
									// mark generated if query succeeded
									if (result?.error == null) {
										setLastGeneratedKey(currentReportKey);
									}
								}}
								disabled={reportLoading}
							>
								{reportLoading
									? "Generating..."
									: lastGeneratedKey === currentReportKey
										? "Regenerate Report"
										: "Generate Report"}
							</Button>
						</div>
					</div>
				</CardContent>
			</Card>
			<div className="flex justify-start">
				<Button
					variant="outline"
					onClick={exportCsv}
					disabled={reportLoading || (reportData?.reports ?? []).length === 0}
				>
					<DownloadIcon className="mr-2 h-4 w-4" />
					Download CSV
				</Button>
			</div>
			<DataTable
				columns={generateColumns()}
				data={reportData?.reports ?? []}
				isLoading={reportLoading}
			/>
			<div className="flex flex-col justify-between items-center gap-2">
				<p className="text-sm text-muted-foreground">
					Showing {reportData?.total ?? 0} records
				</p>
			</div>
		</div>
	);
}
