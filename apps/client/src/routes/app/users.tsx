import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Filter } from "lucide-react";
import React from "react";
import { RequirePermissions, useAuth } from "@/auth";
import {
	Page,
	PageActions,
	PageContent,
	PageHeader,
	PageTitle,
	TableActions,
	TableContainer,
	TableSearchInput,
	TableToolbar,
} from "@/components/layout";
import { MissingPermissions } from "@/components/guards/missing-permissions";
import {
	DataTable,
	PageSizeSelect,
	SearchInput,
	TablePaginationFooter,
} from "@/components/shared";
import { Button } from "@/components/ui/button";
import type { Role } from "@/components/users/columns";
import { generateColumns } from "@/components/users/columns";
import { CreateDialog } from "@/components/users/create-dialog";
import { FilterDialog } from "@/components/users/filter-dialog";
import { usePaginationInfo } from "@/hooks/use-pagination-info";
import { useTableState } from "@/hooks/use-table-state";

export const Route = createFileRoute("/app/users")({
	component: () =>
		RequirePermissions({
			permissions,
			children: <Users />,
			forbiddenFallback: <MissingPermissions />,
		}),
});

export const permissions = ["users.list"];

function Users() {
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
	} = useTableState();
	const [filterRoles, setFilterRoles] = React.useState<Role[]>([]);

	const queryParams = React.useMemo(() => {
		return {
			search:
				debouncedSearch.trim() === "" ? undefined : debouncedSearch.trim(),
			offset,
			filterRoles,
			limit: pageSize,
		};
	}, [debouncedSearch, offset, pageSize, filterRoles]);

	const { data = { users: [], total: 0 }, isLoading } = useQuery({
		// filterRoles needs to be an array of IDs for the query key to work properly
		queryKey: [
			"users",
			{ ...queryParams, filterRoles: filterRoles.map((r) => r.id) },
		],
		queryFn: async () => {
			return await trpc.users.list.query({
				...queryParams,
				filterRoles: filterRoles.map((r) => r.id),
			});
		},
		retry: false,
	});

	const columns = generateColumns(useAuth().user);
	const { totalPages } = usePaginationInfo({
		total: data.total,
		pageSize,
		offset,
		currentCount: data.users.length,
	});

	return (
		<Page>
			<PageHeader>
				<PageTitle>Users</PageTitle>
				<PageActions>
					<CreateDialog onUpdate={() => resetToFirstPage()} />
				</PageActions>
			</PageHeader>

			<PageContent>
				<TableContainer>
					<TableToolbar>
						<TableSearchInput>
							<FilterDialog
								onFilterChange={(newFilterRoles) => {
									setFilterRoles(newFilterRoles);
									resetToFirstPage();
								}}
								filterRoles={filterRoles}
								trigger={
									<Button variant="outline" size="icon">
										<Filter className="size-4" />
									</Button>
								}
							/>
							<SearchInput
								placeholder="Search users..."
								value={search}
								onChange={(value) => {
									setSearch(value);
									resetToFirstPage();
								}}
							/>
						</TableSearchInput>
						<TableActions>
							<PageSizeSelect
								pageSize={pageSize}
								onPageSizeChange={(size) => {
									setPageSize(size);
									resetToFirstPage();
								}}
							/>
						</TableActions>
					</TableToolbar>

					<DataTable
						columns={columns}
						data={data.users}
						isLoading={isLoading}
						emptyMessage="No users found"
						emptyDescription="Try adjusting your search or filters"
					/>

					<TablePaginationFooter
						page={page}
						totalPages={totalPages}
						onPageChange={setPage}
						offset={offset}
						currentCount={data.users.length}
						total={data.total}
						itemName="users"
					/>
				</TableContainer>
			</PageContent>
		</Page>
	);
}
