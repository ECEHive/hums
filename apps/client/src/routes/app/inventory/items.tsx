import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2Icon, RefreshCcwIcon } from "lucide-react";
import React from "react";
// Items listing is public
import { generateColumns } from "@/components/inventory/columns";
import { CreateDialog } from "@/components/inventory/create-dialog";
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
import { Button } from "@/components/ui/button";
import { usePaginationInfo } from "@/hooks/use-pagination-info";
import { useTableState } from "@/hooks/use-table-state";

export const Route = createFileRoute("/app/inventory/items")({
	component: () => <Items />,
});

export function Items() {
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
		data = { items: [], count: 0 },
		isLoading,
		isFetching,
		refetch,
	} = useQuery({
		queryKey: ["inventory", "items", queryParams],
		queryFn: async () => await trpc.inventory.items.list.query(queryParams),
		retry: false,
	});

	const columns = generateColumns();
	const { totalPages } = usePaginationInfo({
		total: data.count,
		pageSize,
		offset,
		currentCount: data.items.length,
	});

	return (
		<Page>
			<PageHeader>
				<PageTitle>Items</PageTitle>
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
								placeholder="Search items..."
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
						data={data.items.map((item) => ({
							...item,
							createdAt: item.createdAt.toISOString(),
							updatedAt: item.updatedAt.toISOString(),
							snapshot: item.snapshot
								? {
										...item.snapshot,
										takenAt: item.snapshot.takenAt.toISOString(),
									}
								: null,
						}))}
						isLoading={isLoading}
						emptyMessage="No items found"
						emptyDescription="Try adjusting your search"
					/>

					<TablePaginationFooter
						page={page}
						totalPages={totalPages}
						onPageChange={setPage}
						offset={offset}
						currentCount={data.items.length}
						total={data.count}
						itemName="items"
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
