import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2Icon, RefreshCcwIcon } from "lucide-react";
import React from "react";
import { RequirePermissions } from "@/auth/AuthProvider";
import { MissingPermissions } from "@/components/guards/missing-permissions";
import { generateColumns } from "@/components/inventory/transaction-columns";
import { TransactionDataTable } from "@/components/inventory/transaction-data-table";
import { generateSummaryColumns } from "@/components/inventory/transaction-summary-columns";
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
import type { RequiredPermissions } from "@/lib/permissions";

export const Route = createFileRoute("/app/inventory/transactions")({
	component: () =>
		RequirePermissions({
			permissions,
			children: <Transactions />,
			forbiddenFallback: <MissingPermissions />,
		}),
});

export const permissions = [
	"inventory.transactions.list",
] as RequiredPermissions;

function Transactions() {
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
		queryKey: ["inventory", "transactions", "list", queryParams],
		queryFn: async () =>
			await trpc.inventory.transactions.list.query(queryParams),
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
		queryKey: ["inventory", "transactions", "netBalance", summaryQueryParams],
		queryFn: async () =>
			await trpc.inventory.transactions.getNetBalance.query(
				summaryQueryParams,
			),
		retry: false,
	});

	const historyColumns = React.useMemo(() => generateColumns(), []);
	const summaryColumns = React.useMemo(() => generateSummaryColumns(), []);
	const { totalPages } = usePaginationInfo({
		total: data.count,
		pageSize,
		offset,
		currentCount: data.transactions.length,
	});

	return (
		<Page>
			<PageHeader>
				<PageTitle>Transactions</PageTitle>
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
						<TabsTrigger value="summary">Balance Summary</TabsTrigger>
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
								emptyMessage="No items with net balance"
								emptyDescription={
									debouncedSearch
										? "Try adjusting your search"
										: "All items are balanced"
								}
							/>
						</TableContainer>
					</TabsContent>{" "}
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
								emptyDescription="Try adjusting your search"
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
