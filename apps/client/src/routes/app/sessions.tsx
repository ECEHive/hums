import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronDownIcon, ClockIcon, Filter, X } from "lucide-react";
import React from "react";
import { RequirePermissions } from "@/auth";
import { MissingPermissions } from "@/components/missing-permissions";
import { columns } from "@/components/sessions/columns";
import { DataTable } from "@/components/sessions/data-table";
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
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useDebounce } from "@/lib/debounce";

export const Route = createFileRoute("/app/sessions")({
	component: () =>
		RequirePermissions({
			permissions,
			children: <SessionsPage />,
			forbiddenFallback: <MissingPermissions />,
		}),
});

export const permissions = ["sessions.list"];

function SessionsPage() {
	const [page, setPage] = React.useState(1);
	const [pageSize, setPageSize] = React.useState(20);
	const [search, setSearch] = React.useState("");
	const [filterSessionType, setFilterSessionType] = React.useState<
		"regular" | "staffing" | null
	>(null);
	const debouncedSearch = useDebounce(search, 300);

	const limit = pageSize;
	const offset = (page - 1) * limit;

	const queryParams = React.useMemo(() => {
		const params: {
			limit: number;
			offset: number;
			filterSessionType?: "regular" | "staffing";
			filterUser?: string;
		} = {
			limit,
			offset,
		};

		if (filterSessionType) {
			params.filterSessionType = filterSessionType;
		}

		if (debouncedSearch.trim()) {
			params.filterUser = debouncedSearch.trim();
		}

		return params;
	}, [limit, offset, filterSessionType, debouncedSearch]);

	// Reset to first page when the debounced search or filters change
	React.useEffect(() => {
		setPage(1);
	}, [debouncedSearch, filterSessionType, pageSize]);

	const { data: sessionsData, isLoading } = useQuery({
		queryKey: ["sessions", queryParams],
		queryFn: async () => {
			return trpc.sessions.list.query(queryParams);
		},
	});

	const { data: statsData, isLoading: isStatsLoading } = useQuery({
		queryKey: ["sessionsStats"],
		queryFn: async () => {
			return trpc.sessions.stats.query({});
		},
	});

	const sessions = sessionsData?.sessions ?? [];
	const total = sessionsData?.total ?? 0;
	const totalPages = Math.ceil(total / pageSize) || 1;

	return (
		<div className="container p-4 space-y-4">
			<h1 className="text-2xl font-bold">Sessions</h1>

			{/* Stats Cards */}
			<div className="grid gap-4 md:grid-cols-3">
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">
							Total Active Sessions
						</CardTitle>
						<ClockIcon className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						{isStatsLoading ? (
							<Spinner />
						) : (
							<div className="text-2xl font-bold">
								{statsData?.totalActive ?? 0}
							</div>
						)}
						<p className="text-xs text-muted-foreground">currently active</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">
							Active Regular Sessions
						</CardTitle>
						<ClockIcon className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						{isStatsLoading ? (
							<Spinner />
						) : (
							<div className="text-2xl font-bold">
								{statsData?.activeRegular ?? 0}
							</div>
						)}
						<p className="text-xs text-muted-foreground">regular sessions</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">
							Active Staffing Sessions
						</CardTitle>
						<ClockIcon className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						{isStatsLoading ? (
							<Spinner />
						) : (
							<div className="text-2xl font-bold">
								{statsData?.activeStaffing ?? 0}
							</div>
						)}
						<p className="text-xs text-muted-foreground">staffing sessions</p>
					</CardContent>
				</Card>
			</div>

			{/* Sessions Table */}
			<Card>
				<CardHeader>
					<div className="flex flex-col gap-4">
						<div className="flex justify-between items-center">
							<div>
								<CardTitle>All Sessions</CardTitle>
								<CardDescription>
									View and filter all user sessions
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

						{/* Filters */}
						<div className="flex flex-col sm:flex-row gap-2">
							<Input
								placeholder="Search by user name, username, or email..."
								value={search}
								onChange={(e) => {
									setSearch(e.target.value);
								}}
								className="max-w-md"
							/>
							<div className="flex gap-2 flex-wrap">
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button variant="outline" className="gap-2">
											<Filter className="size-4" />
											Session Type
											{filterSessionType && (
												<Badge variant="secondary" className="ml-1">
													{filterSessionType === "staffing"
														? "Staffing"
														: "Regular"}
												</Badge>
											)}
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="start">
										<DropdownMenuItem
											onClick={() => {
												setFilterSessionType(null);
												setPage(1);
											}}
										>
											All Types
										</DropdownMenuItem>
										<DropdownMenuItem
											onClick={() => {
												setFilterSessionType("regular");
												setPage(1);
											}}
										>
											Regular
										</DropdownMenuItem>
										<DropdownMenuItem
											onClick={() => {
												setFilterSessionType("staffing");
												setPage(1);
											}}
										>
											Staffing
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>

								{(search || filterSessionType) && (
									<Button
										variant="ghost"
										onClick={() => {
											setSearch("");
											setFilterSessionType(null);
											setPage(1);
										}}
										className="gap-2"
									>
										<X className="size-4" />
										Clear Filters
									</Button>
								)}
							</div>
						</div>
					</div>
				</CardHeader>
				<CardContent>
					<DataTable columns={columns} data={sessions} isLoading={isLoading} />
					{total > 0 && (
						<div className="flex flex-col justify-between items-center gap-2 mt-4">
							<TablePagination
								page={page}
								totalPages={totalPages}
								onPageChange={setPage}
							/>
							<p className="text-sm text-muted-foreground">
								Showing {offset + 1} -{" "}
								{Math.min(offset + sessions.length, total)} of {total}
							</p>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
