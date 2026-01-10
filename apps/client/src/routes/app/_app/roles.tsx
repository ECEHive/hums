import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2Icon, RefreshCcwIcon } from "lucide-react";
import React from "react";
import { RequirePermissions, useAuth } from "@/auth/AuthProvider";
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
import { generateColumns } from "@/components/roles/columns";
import { CreateDialog } from "@/components/roles/create-dialog";
import {
	DataTable,
	SearchInput,
	TablePaginationFooter,
} from "@/components/shared";
import { Button } from "@/components/ui/button";
import { usePaginationInfo } from "@/hooks/use-pagination-info";
import { useTableState } from "@/hooks/use-table-state";

export const Route = createFileRoute("/app/_app/roles")({
	component: () =>
		RequirePermissions({
			permissions,
			children: <Roles />,
			forbiddenFallback: <MissingPermissions />,
		}),
});

export const permissions = ["roles.list"];

function Roles() {
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

	const queryParams = React.useMemo(() => {
		return {
			search:
				debouncedSearch.trim() === "" ? undefined : debouncedSearch.trim(),
			offset,
			limit: pageSize,
		};
	}, [debouncedSearch, offset, pageSize]);

	const {
		data = { roles: [], total: 0 },
		isLoading,
		isFetching,
		refetch,
	} = useQuery({
		queryKey: ["roles", queryParams],
		queryFn: async () => {
			return await trpc.roles.list.query(queryParams);
		},
		retry: false,
	});

	const columns = generateColumns(useAuth().user);
	const { totalPages } = usePaginationInfo({
		total: data.total,
		pageSize,
		offset,
		currentCount: data.roles.length,
	});

	return (
		<Page>
			<PageHeader>
				<PageTitle>Roles</PageTitle>
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
					<CreateDialog />
				</PageActions>
			</PageHeader>

			<PageContent>
				<TableContainer>
					<TableToolbar>
						<TableSearchInput>
							<SearchInput
								placeholder="Search roles..."
								value={search}
								onChange={(value) => {
									setSearch(value);
									resetToFirstPage();
								}}
							/>
						</TableSearchInput>
					</TableToolbar>

					<DataTable
						columns={columns}
						data={data.roles}
						isLoading={isLoading}
						emptyMessage="No roles found"
						emptyDescription="Try adjusting your search"
					/>

					<TablePaginationFooter
						page={page}
						totalPages={totalPages}
						onPageChange={setPage}
						offset={offset}
						currentCount={data.roles.length}
						total={data.total}
						itemName="roles"
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
