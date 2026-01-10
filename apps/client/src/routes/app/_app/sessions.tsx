import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ClockIcon, Loader2Icon, RefreshCcwIcon, UserCog } from "lucide-react";
import React, { useState } from "react";
import { RequirePermissions, useAuth } from "@/auth";
import { MissingPermissions } from "@/components/guards/missing-permissions";
import {
	Page,
	PageActions,
	PageContent,
	PageHeader,
	PageTitle,
	TableContainer,
	TableSearchInput,
	TableToolbar,
} from "@/components/layout";
import { AdminSessionManagementDialog } from "@/components/sessions/admin-session-management-dialog";
import { generateColumns } from "@/components/sessions/columns";
import {
	DataTable,
	FilterField,
	SearchInput,
	TableFilters,
	TablePaginationFooter,
} from "@/components/shared";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { usePaginationInfo } from "@/hooks/use-pagination-info";
import { useTableState } from "@/hooks/use-table-state";
import { checkPermissions } from "@/lib/permissions";

export const Route = createFileRoute("/app/_app/sessions")({
	component: () =>
		RequirePermissions({
			permissions,
			children: <SessionsPage />,
			forbiddenFallback: <MissingPermissions />,
		}),
});

export const permissions = ["sessions.list"];

function SessionsPage() {
	const { user } = useAuth();
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
	const [manageDialogOpen, setManageDialogOpen] = useState(false);

	const canManageSessions = user && checkPermissions(user, ["sessions.manage"]);

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

	const {
		data: sessionsData,
		isLoading,
		isFetching,
		refetch,
	} = useQuery({
		queryKey: ["sessions", queryParams],
		queryFn: async () => {
			return trpc.sessions.list.query(queryParams);
		},
		refetchInterval: 30000,
	});

	const {
		data: statsData,
		isLoading: isStatsLoading,
		isFetching: isStatsFetching,
		refetch: refetchStats,
	} = useQuery({
		queryKey: ["sessionsStats"],
		queryFn: async () => {
			return trpc.sessions.stats.query({});
		},
		refetchInterval: 30000,
	});

	const sessions = sessionsData?.sessions ?? [];
	const { totalPages } = usePaginationInfo({
		total: sessionsData?.total ?? 0,
		pageSize,
		offset,
		currentCount: sessions.length,
	});

	const columns = generateColumns(user);

	return (
		<Page>
			<PageHeader>
				<PageTitle>Sessions</PageTitle>
				{canManageSessions && (
					<PageActions>
						<Button
							variant="outline"
							onClick={() => {
								refetch();
								refetchStats();
							}}
							disabled={isFetching || isStatsFetching}
						>
							{isFetching || isStatsFetching ? (
								<Loader2Icon className="size-4 animate-spin" />
							) : (
								<RefreshCcwIcon className="size-4" />
							)}
						</Button>
						<Button onClick={() => setManageDialogOpen(true)}>
							<UserCog className="mr-2 h-4 w-4" />
							Manage User Session
						</Button>
					</PageActions>
				)}
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
								<TableSearchInput className="max-w-md">
									<SearchInput
										placeholder="Search by user name, username, or email..."
										value={search}
										onChange={(value) => {
											setSearch(value);
											resetToFirstPage();
										}}
									/>
								</TableSearchInput>
								<TableFilters
									activeFiltersCount={filterSessionType ? 1 : 0}
									hasActiveFilters={!!filterSessionType}
									onReset={() => {
										setFilterSessionType(null);
										resetToFirstPage();
									}}
								>
									<FilterField label="Session Type">
										<Select
											value={filterSessionType || "all"}
											onValueChange={(value) => {
												setFilterSessionType(
													value === "all"
														? null
														: (value as "regular" | "staffing"),
												);
												resetToFirstPage();
											}}
										>
											<SelectTrigger>
												<SelectValue placeholder="All types" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="all">All types</SelectItem>
												<SelectItem value="regular">Regular</SelectItem>
												<SelectItem value="staffing">Staffing</SelectItem>
											</SelectContent>
										</Select>
									</FilterField>
								</TableFilters>
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
									pageSize={pageSize}
									onPageSizeChange={(size) => {
										setPageSize(size);
										resetToFirstPage();
									}}
									pageSizeOptions={[10, 20, 50, 100]}
								/>
							)}
						</TableContainer>
					</CardContent>
				</Card>
			</PageContent>

			<AdminSessionManagementDialog
				open={manageDialogOpen}
				onOpenChange={setManageDialogOpen}
			/>
		</Page>
	);
}
