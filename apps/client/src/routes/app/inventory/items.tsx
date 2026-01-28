import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { BarcodeIcon, Loader2Icon, RefreshCcwIcon } from "lucide-react";
import React from "react";
import { useAuth } from "@/auth/AuthProvider";
import { generateColumns } from "@/components/inventory/columns";
import { CreateDialog } from "@/components/inventory/create-dialog";
import { ImportCsvDialog } from "@/components/inventory/import-csv-dialog";
import type { ItemRow } from "@/components/inventory/types";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { usePaginationInfo } from "@/hooks/use-pagination-info";
import { useTableState } from "@/hooks/use-table-state";
import { printBarcodeLabels } from "@/lib/inventory/barcode-labels";
import { checkPermissions } from "@/lib/permissions";

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

	// Filter states
	const [activeFilter, setActiveFilter] = React.useState<
		"active" | "inactive" | "all"
	>("active");
	const [showLowQuantity, setShowLowQuantity] = React.useState(false);

	const queryParams = React.useMemo(() => {
		return {
			search:
				debouncedSearch.trim() === "" ? undefined : debouncedSearch.trim(),
			offset,
			limit: pageSize,
			isActive: activeFilter === "all" ? undefined : activeFilter === "active",
			lowQuantity: showLowQuantity || undefined,
		};
	}, [debouncedSearch, offset, pageSize, activeFilter, showLowQuantity]);

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

	const handlePrintBarcodes = React.useCallback(() => {
		// Convert items to ItemRow format for barcode generation
		const itemRows: ItemRow[] = data.items.map((item) => ({
			...item,
			createdAt: item.createdAt.toISOString(),
			updatedAt: item.updatedAt.toISOString(),
			snapshot: item.snapshot
				? {
						quantity: item.snapshot.quantity,
					}
				: null,
		}));

		printBarcodeLabels(itemRows);
	}, [data.items]);

	const user = useAuth().user;
	// Require creation permission to print barcodes
	const canPrintBarcodes =
		user && checkPermissions(user, ["inventory.items.create"]);

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
					<Button
						variant="outline"
						onClick={handlePrintBarcodes}
						disabled={data.items.length === 0}
						hidden={!canPrintBarcodes}
					>
						<BarcodeIcon className="size-4" />
						Print Labels
					</Button>
					<ImportCsvDialog onImportComplete={() => resetToFirstPage()} />
					<CreateDialog onUpdate={() => resetToFirstPage()} />
				</PageActions>
			</PageHeader>{" "}
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
						<div className="flex items-center gap-4">
							<div className="flex items-center gap-2">
								<Label htmlFor="active-filter" className="text-sm font-medium">
									Status:
								</Label>
								<Select
									value={activeFilter}
									onValueChange={(value: "active" | "inactive" | "all") => {
										setActiveFilter(value);
										resetToFirstPage();
									}}
								>
									<SelectTrigger id="active-filter" className="w-[140px]">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="active">Active only</SelectItem>
										<SelectItem value="inactive">Inactive only</SelectItem>
										<SelectItem value="all">All items</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div className="flex items-center gap-2">
								<Checkbox
									id="low-quantity"
									checked={showLowQuantity}
									onCheckedChange={(checked) => {
										setShowLowQuantity(checked === true);
										resetToFirstPage();
									}}
								/>
								<Label
									htmlFor="low-quantity"
									className="text-sm font-medium cursor-pointer"
								>
									Low quantity
								</Label>
							</div>
						</div>
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
