import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	AlertTriangleIcon,
	Loader2Icon,
	RefreshCcwIcon,
	SettingsIcon,
} from "lucide-react";
import React from "react";
import { RequirePermissions } from "@/auth/AuthProvider";
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
import {
	DataTable,
	FilterField,
	SearchInput,
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

export const Route = createFileRoute("/app/tickets/admin/")({
	component: () =>
		RequirePermissions({
			permissions,
			children: <AdminTicketsPage />,
			forbiddenFallback: <MissingPermissions />,
		}),
});

export const permissions = ["tickets.manage"] as RequiredPermissions;

type AdminTicketsFilters = {
	status: string;
	typeId: string;
	assignment: string;
};

const DEFAULT_FILTERS: AdminTicketsFilters = {
	status: "all",
	typeId: "all",
	assignment: "all",
};

function AdminTicketsPage() {
	const {
		page,
		setPage,
		pageSize,
		setPageSize,
		offset,
		search,
		setSearch,
		debouncedSearch,
		filters,
		setFilters,
		resetToFirstPage,
	} = usePersistedTableState<AdminTicketsFilters>({
		pageKey: "admin-tickets",
		defaultFilters: DEFAULT_FILTERS,
	});

	const statusFilter = filters?.status ?? "all";
	const typeFilter = filters?.typeId ?? "all";
	const assignmentFilter = filters?.assignment ?? "all";

	// Fetch ticket types for filter dropdown
	const { data: ticketTypes } = useQuery({
		queryKey: ["ticket-types-all"],
		queryFn: async () => {
			return await trpc.tickets.types.list.query({ activeOnly: false });
		},
	});

	const queryParams = React.useMemo(() => {
		return {
			search:
				debouncedSearch.trim() === "" ? undefined : debouncedSearch.trim(),
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
			ticketTypeId: typeFilter === "all" ? undefined : Number(typeFilter),
			unassigned: assignmentFilter === "unassigned" ? true : undefined,
			limit: pageSize,
			offset,
		};
	}, [
		debouncedSearch,
		statusFilter,
		typeFilter,
		assignmentFilter,
		pageSize,
		offset,
	]);

	const {
		data = { tickets: [], total: 0 },
		isLoading,
		isFetching,
		refetch,
	} = useQuery({
		queryKey: ["admin-tickets", queryParams],
		queryFn: async () => {
			return await trpc.tickets.list.query(queryParams);
		},
	});

	const columns = generateColumns({
		linkTo: "admin",
		showSubmitter: true,
		showHandler: true,
	});
	const { totalPages } = usePaginationInfo({
		total: data.total,
		pageSize,
		offset,
		currentCount: data.tickets.length,
	});

	const activeFiltersCount =
		(statusFilter !== "all" ? 1 : 0) +
		(typeFilter !== "all" ? 1 : 0) +
		(assignmentFilter !== "all" ? 1 : 0);

	return (
		<Page>
			<PageHeader>
				<PageTitle>All Tickets</PageTitle>
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
					<Link to="/app/tickets/admin/types">
						<Button variant="outline">
							<SettingsIcon className="h-4 w-4 mr-2" />
							Manage Types
						</Button>
					</Link>
				</PageActions>
			</PageHeader>

			<PageContent>
				<TableContainer>
					<TableToolbar>
						<TableSearchInput>
							<SearchInput
								placeholder="Search tickets..."
								value={search}
								onChange={(value) => {
									setSearch(value);
									resetToFirstPage();
								}}
							/>
						</TableSearchInput>
						<TableFilters
							activeFiltersCount={activeFiltersCount}
							hasActiveFilters={activeFiltersCount > 0}
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

							<FilterField
								label="Ticket Type"
								description="Filter by ticket type"
							>
								<Select
									value={typeFilter}
									onValueChange={(value) => {
										setFilters((prev) => ({
											...DEFAULT_FILTERS,
											...prev,
											typeId: value,
										}));
										resetToFirstPage();
									}}
								>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">All Types</SelectItem>
										{ticketTypes?.map((type) => (
											<SelectItem key={type.id} value={type.id.toString()}>
												{type.name
													.split("-")
													.map(
														(word) =>
															word.charAt(0).toUpperCase() + word.slice(1),
													)
													.join(" ")}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</FilterField>

							<FilterField
								label="Assignment"
								description="Filter by assignment status"
							>
								<Select
									value={assignmentFilter}
									onValueChange={(value) => {
										setFilters((prev) => ({
											...DEFAULT_FILTERS,
											...prev,
											assignment: value,
										}));
										resetToFirstPage();
									}}
								>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">All</SelectItem>
										<SelectItem value="unassigned">Unassigned</SelectItem>
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
						emptyDescription="Try adjusting your search or filters"
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
