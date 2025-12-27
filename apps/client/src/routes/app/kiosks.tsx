import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import React from "react";
import { RequirePermissions } from "@/auth";
import { MissingPermissions } from "@/components/guards/missing-permissions";
import { generateColumns } from "@/components/kiosks/columns";
import { CreateDialog } from "@/components/kiosks/create-dialog";
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
import {
	DataTable,
	PageSizeSelect,
	SearchInput,
	TablePaginationFooter,
} from "@/components/shared";
import { usePaginationInfo } from "@/hooks/use-pagination-info";
import { useTableState } from "@/hooks/use-table-state";

export const Route = createFileRoute("/app/kiosks")({
	component: () =>
		RequirePermissions({
			permissions,
			children: <Kiosks />,
			forbiddenFallback: <MissingPermissions />,
		}),
});

export const permissions = ["kiosks.list"];

function Kiosks() {
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

	const { data = { kiosks: [], count: 0 }, isLoading } = useQuery({
		queryKey: ["kiosks", queryParams],
		queryFn: async () => {
			return await trpc.kiosks.list.query(queryParams);
		},
		retry: false,
	});

	const columns = generateColumns();
	const { totalPages } = usePaginationInfo({
		total: data.count,
		pageSize,
		offset,
		currentCount: data.kiosks.length,
	});

	return (
		<Page>
			<PageHeader>
				<PageTitle>Kiosks</PageTitle>
				<PageActions>
					<CreateDialog onUpdate={() => resetToFirstPage()} />
				</PageActions>
			</PageHeader>

			<PageContent>
				<TableContainer>
					<TableToolbar>
						<TableSearchInput>
							<SearchInput
								placeholder="Search kiosks..."
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
						data={data.kiosks}
						isLoading={isLoading}
						emptyMessage="No kiosks found"
						emptyDescription="Try adjusting your search"
					/>

					<TablePaginationFooter
						page={page}
						totalPages={totalPages}
						onPageChange={setPage}
						offset={offset}
						currentCount={data.kiosks.length}
						total={data.count}
						itemName="kiosks"
					/>
				</TableContainer>
			</PageContent>
		</Page>
	);
}
