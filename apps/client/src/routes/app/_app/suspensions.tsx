import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
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
	DataTable,
	SearchInput,
	TablePaginationFooter,
} from "@/components/shared";
import { generateColumns } from "@/components/suspensions/columns";
import { SuspensionCreateDialog } from "@/components/suspensions/create-dialog";
import { usePaginationInfo } from "@/hooks/use-pagination-info";
import { useTableState } from "@/hooks/use-table-state";

export const Route = createFileRoute("/app/_app/suspensions")({
	component: () =>
		RequirePermissions({
			permissions,
			children: <Suspensions />,
			forbiddenFallback: <MissingPermissions />,
		}),
});

export const permissions = ["suspensions.list"];

function Suspensions() {
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

	const { data = { suspensions: [], total: 0 }, isLoading } = useQuery({
		queryKey: ["suspensions", queryParams],
		queryFn: async () => {
			return await trpc.suspensions.list.query(queryParams);
		},
		retry: false,
	});

	const columns = generateColumns(useAuth().user);
	const { totalPages } = usePaginationInfo({
		total: data.total,
		pageSize,
		offset,
		currentCount: data.suspensions.length,
	});

	return (
		<Page>
			<PageHeader>
				<PageTitle>Suspensions</PageTitle>
				<PageActions>
					<SuspensionCreateDialog onUpdate={() => resetToFirstPage()} />
				</PageActions>
			</PageHeader>

			<PageContent>
				<TableContainer>
					<TableToolbar>
						<TableSearchInput>
							<SearchInput
								placeholder="Search suspensions..."
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
						data={data.suspensions}
						isLoading={isLoading}
						emptyMessage="No suspensions found"
						emptyDescription="Create a suspension to restrict user access"
					/>

					<TablePaginationFooter
						page={page}
						totalPages={totalPages}
						onPageChange={setPage}
						offset={offset}
						currentCount={data.suspensions.length}
						total={data.total}
						itemName="suspensions"
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
