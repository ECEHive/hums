import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronDownIcon, NotebookTextIcon } from "lucide-react";
import React from "react";
import { RequirePermissions } from "@/auth";
import DateRangeSelector from "@/components/date-range-selector";
import { MissingPermissions } from "@/components/missing-permissions";
import { usePeriod } from "@/components/period-provider";
import { generateColumns } from "@/components/reports/columns";
import { DataTable } from "@/components/reports/data-table";
import { RoleSelect } from "@/components/roles/role-select";
import { TablePagination } from "@/components/table-pagination";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
	const [selectedRole, setSelectedRole] = React.useState<number | null>(null);
	const { period: periodId } = usePeriod();

	const [page, setPage] = React.useState(1);
	const [pageSize, setPageSize] = React.useState(10);

	const offset = (page - 1) * pageSize;

	const reportParams = {
		startDate: start?.toISOString() ?? undefined,
		endDate: end?.toISOString() ?? undefined,
		// do not provide a default role; generation requires an explicit selection
		staffingRoleId: selectedRole ?? undefined,
	};

	const {
		data: reportData,
		isLoading: reportLoading,
		refetch: refetchReport,
	} = useQuery({
		queryKey: ["reports.generate", reportParams],
		queryFn: async () => {
			// only generate when a role is explicitly selected
			if (selectedRole == null) return { reports: [], total: 0 };
			return trpc.reports.generate.query({
				...reportParams,
				staffingRoleId: selectedRole as number,
			});
		},
		retry: false,
		// don't auto-run the query on mount or when params change; only run when the user presses Generate
		enabled: false,
	});

	const totalPages = Math.max(
		1,
		Math.ceil((reportData?.total ?? 0) / pageSize),
	);

	const { data: periodData, isLoading: periodLoading } = useQuery({
		queryKey: ["period", Number(periodId)],
		queryFn: async () => {
			if (!periodId) return null;
			const res = await trpc.periods.get.query({ id: Number(periodId) });
			setStart(res?.period?.start ?? null);
			setEnd(res?.period?.end ?? null);
			return res;
		},
	});

	const { data: rolesData, isLoading: rolesLoading } = useQuery({
		queryKey: ["roles.list"],
		queryFn: async () => {
			return await trpc.roles.list.query({});
		},
	});

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
							<div className="text-sm font-medium mb-1">Staffing Role</div>
							{rolesLoading ? (
								<Spinner />
							) : (
								<RoleSelect
									value={
										selectedRole
											? (rolesData?.roles.find((r) => r.id === selectedRole) ??
												null)
											: null
									}
									onChange={(role) => setSelectedRole(role?.id ?? null)}
									placeholder="Select staffing role..."
								/>
							)}
						</div>
						<div className="pt-2">
							<Button
								variant="default"
								onClick={async () => {
									await refetchReport();
									setPage(1);
								}}
								disabled={reportLoading || selectedRole == null}
							>
								{selectedRole == null
									? "Select a role"
									: reportLoading
										? "Generating..."
										: "Generate Report"}
							</Button>
						</div>
					</div>
				</CardContent>
			</Card>
			<div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
				{/* <div className="flex items-center gap-2">
					<FilterDialog
						onFilterChange={(newFilterRoles) => {
							setPage(1);
							setFilterRoles(newFilterRoles);
						}}
						filterRoles={filterRoles}
						trigger={
							<Button variant="outline">
								<Filter className="size-4" />
							</Button>
						}
					/>
					<Input
						placeholder="Search users..."
						value={search}
						onChange={(e) => {
							setSearch(e.target.value);
							setPage(1);
						}}
						className="max-w-xs"
					/>
				</div> */}
				<div className="flex items-center gap-2">
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="outline">
								{pageSize} per page <ChevronDownIcon className="ml-2 size-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							{[10, 25, 50, 100].map((size) => (
								<DropdownMenuItem
									key={size}
									onClick={async () => {
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
			</div>
			<DataTable
				columns={generateColumns()}
				data={reportData?.reports ?? []}
				isLoading={reportLoading}
			/>
			<div className="flex flex-col justify-between items-center gap-2">
				<TablePagination
					page={page}
					totalPages={totalPages}
					onPageChange={setPage}
				/>
				<p className="text-sm text-muted-foreground">
					Showing {offset + 1} - {offset + (reportData?.reports.length ?? 0)} of{" "}
					{reportData?.total ?? 0}
				</p>
			</div>
		</div>
	);
}
