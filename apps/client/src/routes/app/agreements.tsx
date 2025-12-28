import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import React from "react";
import { RequirePermissions, useAuth } from "@/auth/AuthProvider";
import { generateColumns } from "@/components/agreements/columns";
import { CreateDialog } from "@/components/agreements/create-dialog";
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
	SearchInput,
	TablePaginationFooter,
} from "@/components/shared";
import { usePaginationInfo } from "@/hooks/use-pagination-info";
import { useTableState } from "@/hooks/use-table-state";

export const Route = createFileRoute("/app/agreements")({
	component: () =>
		RequirePermissions({
			permissions,
			children: <Agreements />,
			forbiddenFallback: <MissingPermissions />,
		}),
});

export const permissions = ["agreements.list"];

function Agreements() {
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

	const { data = { agreements: [], total: 0 }, isLoading } = useQuery({
		queryKey: ["agreements", queryParams],
		queryFn: async () => {
			return await trpc.agreements.list.query(queryParams);
		},
		retry: false,
	});

	const columns = generateColumns(useAuth().user);
	const { totalPages } = usePaginationInfo({
		total: data.total,
		pageSize,
		offset,
		currentCount: data.agreements.length,
	});

	return (
		<Page>
			<PageHeader>
				<PageTitle>Agreements</PageTitle>
				<PageActions>
					<CreateDialog />
				</PageActions>
			</PageHeader>

			<PageContent>
				<TableContainer>
					<TableToolbar>
						<TableSearchInput>
							<SearchInput
								placeholder="Search agreements..."
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
						data={data.agreements}
						isLoading={isLoading}
						emptyMessage="No agreements found"
						emptyDescription="Try adjusting your search"
					/>

					<TablePaginationFooter
						page={page}
						totalPages={totalPages}
						onPageChange={setPage}
						offset={offset}
						currentCount={data.agreements.length}
						total={data.total}
						itemName="agreements"
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
