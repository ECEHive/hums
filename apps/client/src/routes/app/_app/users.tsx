import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2Icon, RefreshCcwIcon } from "lucide-react";
import React from "react";
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
import {
	type Role,
	RoleMultiSelect,
} from "@/components/roles/role-multiselect";
import {
	DataTable,
	FilterField,
	SearchInput,
	TableFilters,
	TablePaginationFooter,
} from "@/components/shared";
import { Button } from "@/components/ui/button";
import { generateColumns } from "@/components/users/columns";
import { CreateDialog } from "@/components/users/create-dialog";
import { usePaginationInfo } from "@/hooks/use-pagination-info";
import { usePersistedTableState } from "@/hooks/use-persisted-table-state";

export const Route = createFileRoute("/app/_app/users")({
	component: () =>
		RequirePermissions({
			permissions,
			children: <Users />,
			forbiddenFallback: <MissingPermissions />,
		}),
});

export const permissions = ["users.list"];

type UsersFilters = {
	filterRoles: Role[];
};

const DEFAULT_FILTERS: UsersFilters = {
	filterRoles: [],
};

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
		filters,
		setFilters,
		resetToFirstPage,
	} = usePersistedTableState<UsersFilters>({
		pageKey: "users",
		defaultFilters: DEFAULT_FILTERS,
	});

	const filterRoles = filters?.filterRoles ?? [];

	const queryParams = React.useMemo(() => {
		return {
			search:
				debouncedSearch.trim() === "" ? undefined : debouncedSearch.trim(),
			offset,
			filterRoles,
			limit: pageSize,
		};
	}, [debouncedSearch, offset, pageSize, filterRoles]);

	const {
		data = { users: [], total: 0 },
		isFetching,
		isLoading,
		refetch,
	} = useQuery({
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
					<CreateDialog onUpdate={() => resetToFirstPage()} />
				</PageActions>
			</PageHeader>

			<PageContent>
				<TableContainer>
					<TableToolbar>
						<TableSearchInput>
							<SearchInput
								placeholder="Search users..."
								value={search}
								onChange={(value) => {
									setSearch(value);
									resetToFirstPage();
								}}
							/>
						</TableSearchInput>
						<TableFilters
							activeFiltersCount={filterRoles.length}
							hasActiveFilters={filterRoles.length > 0}
							onReset={() => {
								setFilters(DEFAULT_FILTERS);
								resetToFirstPage();
							}}
						>
							<FilterField
								label="Roles"
								description="Show users with any of the selected roles"
							>
								<RoleMultiSelect
									value={filterRoles}
									onChange={(newRoles) => {
										setFilters((prev) => ({
											...DEFAULT_FILTERS,
											...prev,
											filterRoles: newRoles,
										}));
										resetToFirstPage();
									}}
								/>
							</FilterField>
						</TableFilters>
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
