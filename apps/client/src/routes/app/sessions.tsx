import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ClockIcon, Filter, X } from "lucide-react";
import React from "react";
import { RequirePermissions } from "@/auth";
import { MissingPermissions } from "@/components/guards/missing-permissions";
import {
	Page,
	PageContent,
	PageHeader,
	PageTitle,
	TableActions,
	TableContainer,
	TableSearchInput,
	TableToolbar,
} from "@/components/layout";
import { columns } from "@/components/sessions/columns";
import {
	DataTable,
	PageSizeSelect,
	SearchInput,
	TablePaginationFooter,
} from "@/components/shared";
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
import { Spinner } from "@/components/ui/spinner";
import { usePaginationInfo } from "@/hooks/use-pagination-info";
import { useTableState } from "@/hooks/use-table-state";

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
	const {
		page,
		setPage,
		pageSize,
		setPageSize,
		offset,
		search,
		setSearch,
		debouncedSearch,
		resetToFirstPage,
	} = useTableState({ initialPageSize: 20 });
	const [filterSessionType, setFilterSessionType] = React.useState<
		"regular" | "staffing" | null
	>(null);

	const queryParams = React.useMemo(() => {
		const params: {
			limit: number;
			offset: number;
			filterSessionType?: "regular" | "staffing";
			filterUser?: string;
		} = {
			limit: pageSize,
			offset,
		};

		if (filterSessionType) {
			params.filterSessionType = filterSessionType;
		}

		if (debouncedSearch.trim()) {
			params.filterUser = debouncedSearch.trim();
		}

		return params;
	}, [pageSize, offset, filterSessionType, debouncedSearch]);

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
	const { totalPages } = usePaginationInfo({
		total: sessionsData?.total ?? 0,
		pageSize,
		offset,
		currentCount: sessions.length,
	});

	return (
		<Page>
			<PageHeader>
				<PageTitle>Sessions</PageTitle>
			</PageHeader>

			<PageContent>
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
						<CardTitle>All Sessions</CardTitle>
						<CardDescription>View and filter all user sessions</CardDescription>
					</CardHeader>
					<CardContent>
						<TableContainer>
							<TableToolbar>
								<TableSearchInput>
									<SearchInput
										placeholder="Search by user name, username, or email..."
										value={search}
										onChange={(value) => {
											setSearch(value);
											resetToFirstPage();
										}}
									/>
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
													resetToFirstPage();
												}}
											>
												All Types
											</DropdownMenuItem>
											<DropdownMenuItem
												onClick={() => {
													setFilterSessionType("regular");
													resetToFirstPage();
												}}
											>
												Regular
											</DropdownMenuItem>
											<DropdownMenuItem
												onClick={() => {
													setFilterSessionType("staffing");
													resetToFirstPage();
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
												resetToFirstPage();
											}}
											className="gap-2"
										>
											<X className="size-4" />
											Clear Filters
										</Button>
									)}
								</TableSearchInput>
								<TableActions>
									<PageSizeSelect
										pageSize={pageSize}
										onPageSizeChange={(size) => {
											setPageSize(size);
											resetToFirstPage();
										}}
										pageSizeOptions={[10, 20, 50, 100]}
									/>
								</TableActions>
							</TableToolbar>

							<DataTable
								columns={columns}
								data={sessions}
								isLoading={isLoading}
								emptyMessage="No sessions found"
								emptyDescription="Try adjusting your search or filters"
							/>

							{sessionsData && sessionsData.total > 0 && (
								<TablePaginationFooter
									page={page}
									totalPages={totalPages}
									onPageChange={setPage}
									offset={offset}
									currentCount={sessions.length}
									total={sessionsData.total}
									itemName="sessions"
								/>
							)}
						</TableContainer>
					</CardContent>
				</Card>
			</PageContent>
		</Page>
	);
}
