import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	AlertTriangleIcon,
	Loader2Icon,
	PlusCircleIcon,
	RefreshCcwIcon,
} from "lucide-react";
import React from "react";
import { RequireAuth } from "@/auth/AuthProvider";
import {
	Page,
	PageActions,
	PageContent,
	PageHeader,
	PageTitle,
	TableContainer,
	TableToolbar,
} from "@/components/layout";
import {
	DataTable,
	FilterField,
	TableFilters,
	TablePaginationFooter,
} from "@/components/shared";
import { generateColumns, type Ticket } from "@/components/tickets/columns";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { usePaginationInfo } from "@/hooks/use-pagination-info";
import { usePersistedTableState } from "@/hooks/use-persisted-table-state";
import type { RequiredPermissions } from "@/lib/permissions";

export const Route = createFileRoute("/app/tickets/my-tickets")({
	component: () => (
		<RequireAuth>
			<MyTicketsPage />
		</RequireAuth>
	),
});

export const permissions = [] as RequiredPermissions;

type MyTicketsFilters = {
	status: string;
};

const DEFAULT_FILTERS: MyTicketsFilters = {
	status: "all",
};

function MyTicketsPage() {
	const {
		page,
		setPage,
		pageSize,
		setPageSize,
		offset,
		filters,
		setFilters,
		resetToFirstPage,
	} = usePersistedTableState<MyTicketsFilters>({
		pageKey: "my-tickets",
		defaultFilters: DEFAULT_FILTERS,
	});

	const statusFilter = filters?.status ?? "all";

	const queryParams = React.useMemo(() => {
		return {
			statuses:
				statusFilter === "all"
					? undefined
					: [
							statusFilter as
								| "pending"
								| "in_progress"
								| "resolved"
								| "closed"
								| "cancelled",
						],
			limit: pageSize,
			offset,
		};
	}, [statusFilter, pageSize, offset]);

	const {
		data = { tickets: [], total: 0 },
		isLoading,
		isFetching,
		refetch,
	} = useQuery({
		queryKey: ["my-tickets", queryParams],
		queryFn: async () => {
			return await trpc.tickets.listMy.query(queryParams);
		},
	});

	const columns = generateColumns({ linkTo: "my-tickets" });
	const { totalPages } = usePaginationInfo({
		total: data.total,
		pageSize,
		offset,
		currentCount: data.tickets.length,
	});

	return (
		<Page>
			<PageHeader>
				<PageTitle>My Tickets</PageTitle>
				<PageActions>
					<Button
						variant="outline"
						onClick={() => refetch()}
						disabled={isFetching}
					>
						{isFetching ? (
							<Loader2Icon className="size-4 animate-spin" />
						) : (
							<RefreshCcwIcon className="size-4" />
						)}
					</Button>
					<Link to="/submit">
						<Button>
							<PlusCircleIcon className="mr-2 h-4 w-4" />
							Submit New Ticket
						</Button>
					</Link>
				</PageActions>
			</PageHeader>

			<PageContent>
				<TableContainer>
					<TableToolbar>
						<div className="flex-1" />
						<TableFilters
							activeFiltersCount={statusFilter !== "all" ? 1 : 0}
							hasActiveFilters={statusFilter !== "all"}
							onReset={() => {
								setFilters(DEFAULT_FILTERS);
								resetToFirstPage();
							}}
						>
							<FilterField
								label="Status"
								description="Filter tickets by their current status"
							>
								<Select
									value={statusFilter}
									onValueChange={(value) => {
										setFilters((prev) => ({
											...DEFAULT_FILTERS,
											...prev,
											status: value,
										}));
										resetToFirstPage();
									}}
								>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">All Statuses</SelectItem>
										<SelectItem value="pending">Pending</SelectItem>
										<SelectItem value="in_progress">In Progress</SelectItem>
										<SelectItem value="resolved">Resolved</SelectItem>
										<SelectItem value="closed">Closed</SelectItem>
										<SelectItem value="cancelled">Cancelled</SelectItem>
									</SelectContent>
								</Select>
							</FilterField>
						</TableFilters>
					</TableToolbar>

					<DataTable
						columns={columns}
						data={data.tickets as Ticket[]}
						isLoading={isLoading}
						emptyMessage="No tickets found"
						emptyDescription={
							statusFilter === "all"
								? "You haven't submitted any tickets yet."
								: "No tickets match your current filters."
						}
						emptyIcon={<AlertTriangleIcon className="size-8" />}
					/>

					<TablePaginationFooter
						page={page}
						totalPages={totalPages}
						onPageChange={setPage}
						offset={offset}
						currentCount={data.tickets.length}
						total={data.total}
						itemName="tickets"
						pageSize={pageSize}
						onPageSizeChange={(size) => {
							setPageSize(size);
							resetToFirstPage();
						}}
					/>
				</TableContainer>
			</PageContent>
		</Page>
	);
}
