import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2Icon, RefreshCcwIcon } from "lucide-react";
import React from "react";
import { generateMyTransactionColumns } from "@/components/inventory/transaction-columns";
import { TransactionDataTable } from "@/components/inventory/transaction-data-table";
import { generateMySummaryColumns } from "@/components/inventory/transaction-summary-columns";
import { TransactionSummaryDataTable } from "@/components/inventory/transaction-summary-data-table";
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
import { SearchInput, TablePaginationFooter } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePaginationInfo } from "@/hooks/use-pagination-info";
import { useTableState } from "@/hooks/use-table-state";

export const Route = createFileRoute("/app/inventory/my-transactions")({
	component: () => <MyTransactions />,
});

function MyTransactions() {
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
		data = { transactions: [], count: 0 },
		isLoading,
		isFetching,
		refetch,
	} = useQuery({
		queryKey: ["inventory", "transactions", "my", queryParams],
		queryFn: async () =>
			await trpc.inventory.transactions.listMy.query(queryParams),
		retry: false,
	});

	// Fetch net balance data separately
	const summaryQueryParams = React.useMemo(() => {
		return {
			search:
				debouncedSearch.trim() === "" ? undefined : debouncedSearch.trim(),
		};
	}, [debouncedSearch]);

	const { data: summaryData = [] } = useQuery({
		queryKey: ["inventory", "transactions", "myNetBalance", summaryQueryParams],
		queryFn: async () =>
			await trpc.inventory.transactions.getMyNetBalance.query(
				summaryQueryParams,
			),
		retry: false,
	});

	const historyColumns = React.useMemo(
		() => generateMyTransactionColumns(),
		[],
	);
	const summaryColumns = React.useMemo(() => generateMySummaryColumns(), []);
	const { totalPages } = usePaginationInfo({
		total: data.count,
		pageSize,
		offset,
		currentCount: data.transactions.length,
	});

	return (
		<Page>
			<PageHeader>
				<PageTitle>My Transactions</PageTitle>
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
				</PageActions>
			</PageHeader>

			<PageContent>
				<Tabs defaultValue="summary" className="w-full">
					<TabsList className="mb-4">
						<TabsTrigger value="summary">My Balance</TabsTrigger>
						<TabsTrigger value="history">Transaction History</TabsTrigger>
					</TabsList>

					<TabsContent value="summary" className="mt-0">
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

							<TransactionSummaryDataTable
								columns={summaryColumns}
								data={summaryData}
								isLoading={isLoading}
								emptyMessage="No items in your possession"
								emptyDescription={
									debouncedSearch
										? "Try adjusting your search"
										: "You don't have any items checked out"
								}
							/>
						</TableContainer>
					</TabsContent>

					<TabsContent value="history" className="mt-0">
						<TableContainer>
							<TableToolbar>
								<TableSearchInput>
									<SearchInput
										placeholder="Search transactions..."
										value={search}
										onChange={(value) => {
											setSearch(value);
											resetToFirstPage();
										}}
									/>
								</TableSearchInput>
							</TableToolbar>

							<TransactionDataTable
								columns={historyColumns}
								data={data.transactions}
								isLoading={isLoading}
								emptyMessage="No transactions found"
								emptyDescription="You haven't made any inventory transactions yet"
							/>

							{data.count > 0 && (
								<TablePaginationFooter
									page={page}
									totalPages={totalPages}
									onPageChange={setPage}
									offset={offset}
									currentCount={data.transactions.length}
									total={data.count}
									itemName="transactions"
									pageSize={pageSize}
									onPageSizeChange={(size) => {
										setPageSize(size);
										resetToFirstPage();
									}}
								/>
							)}
						</TableContainer>
					</TabsContent>
				</Tabs>
			</PageContent>
		</Page>
	);
}
