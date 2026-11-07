import { trpc } from "@ecehive/trpc/client";
import { useInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowUpDownIcon, Loader2Icon, RefreshCcwIcon } from "lucide-react";
import React from "react";
import { generateColumns } from "@/components/inventory/columns";
import { CreateDialog } from "@/components/inventory/create-dialog";
import { ImportCsvDialog } from "@/components/inventory/import-csv-dialog";
import { ItemsTable } from "@/components/inventory/items-table";
import { PrintBarcodeDialog } from "@/components/inventory/print-barcode-dialog";
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
import { SearchInput } from "@/components/shared";
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
import { useTableState } from "@/hooks/use-table-state";

export const Route = createFileRoute("/app/inventory/items")({
	component: () => <Items />,
});

// How many items to load per request (the server allows up to 100)
const BATCH_SIZE = 100;

export function Items() {
	const { search, setSearch, debouncedSearch } = useTableState();

	// Filter states
	const [activeFilter, setActiveFilter] = React.useState<
		"active" | "inactive" | "all"
	>("active");
	const [showLowQuantity, setShowLowQuantity] = React.useState(false);
	const [sortOrder, setSortOrder] = React.useState<
		"name_asc" | "name_desc" | "none"
	>("none");

	const queryParams = React.useMemo(() => {
		return {
			search:
				debouncedSearch.trim() === "" ? undefined : debouncedSearch.trim(),
			limit: BATCH_SIZE,
			isActive: activeFilter === "all" ? undefined : activeFilter === "active",
			lowQuantity: showLowQuantity || undefined,
			sortBy: sortOrder === "none" ? undefined : sortOrder,
		};
	}, [debouncedSearch, activeFilter, showLowQuantity, sortOrder]);

	// Changing search/filters/sort changes the key, which starts over from the first batch
	const {
		data: pages,
		isLoading,
		isFetching,
		isFetchingNextPage,
		isFetchNextPageError,
		hasNextPage,
		fetchNextPage,
		refetch,
	} = useInfiniteQuery({
		queryKey: ["inventory", "items", queryParams],
		queryFn: async ({ pageParam }) =>
			await trpc.inventory.items.list.query({
				...queryParams,
				offset: pageParam,
			}),
		initialPageParam: 0,
		getNextPageParam: (lastPage, allPages) => {
			const loaded = allPages.reduce((n, page) => n + page.items.length, 0);
			return loaded < lastPage.count ? loaded : undefined;
		},
		retry: false,
	});

	const data = React.useMemo(
		() => ({
			items: pages?.pages.flatMap((page) => page.items) ?? [],
			count: pages?.pages[0]?.count ?? 0,
		}),
		[pages],
	);

	// Keep loading batches in the background until the whole list is here.
	// The table shows placeholder rows for anything not loaded yet.
	React.useEffect(() => {
		if (hasNextPage && !isFetchingNextPage && !isFetchNextPageError) {
			fetchNextPage();
		}
	}, [hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage]);

	const columns = React.useMemo(() => generateColumns(), []);

	// Only rebuild the table rows when the loaded items change, not on every render
	const tableRows = React.useMemo(
		() =>
			data.items.map((item) => ({
				...item,
				createdAt: item.createdAt.toISOString(),
				updatedAt: item.updatedAt.toISOString(),
				snapshot: item.snapshot
					? {
							...item.snapshot,
							takenAt: item.snapshot.takenAt.toISOString(),
						}
					: null,
			})),
		[data.items],
	);

	// Convert items to ItemRow format for barcode generation
	const itemRows: ItemRow[] = React.useMemo(
		() =>
			data.items.map((item) => ({
				...item,
				createdAt: item.createdAt.toISOString(),
				updatedAt: item.updatedAt.toISOString(),
				snapshot: item.snapshot
					? {
							quantity: item.snapshot.quantity,
						}
					: null,
			})),
		[data.items],
	);

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
					<PrintBarcodeDialog
						items={itemRows}
						disabled={data.items.length === 0}
					/>
					<ImportCsvDialog />
					<CreateDialog />
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
								}}
							/>
						</TableSearchInput>
						<div className="flex items-center gap-4">
							<Select
								value={sortOrder}
								onValueChange={(value: "name_asc" | "name_desc" | "none") => {
									setSortOrder(value);
								}}
							>
								<SelectTrigger className="w-10 h-10 p-0 flex justify-center items-center [&>svg:last-child]:hidden">
									<ArrowUpDownIcon className="size-4" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="none">Newest</SelectItem>
									<SelectItem value="name_asc">A to Z</SelectItem>
									<SelectItem value="name_desc">Z to A</SelectItem>
								</SelectContent>
							</Select>
							<div className="flex items-center gap-2">
								<Label htmlFor="active-filter" className="text-sm font-medium">
									Status:
								</Label>
								<Select
									value={activeFilter}
									onValueChange={(value: "active" | "inactive" | "all") => {
										setActiveFilter(value);
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

					<ItemsTable
						columns={columns}
						data={tableRows}
						totalCount={data.count}
						isLoading={isLoading}
					/>

					{!isLoading && (
						<p className="text-sm text-muted-foreground">
							Showing {data.items.length} of {data.count} items
						</p>
					)}
				</TableContainer>
			</PageContent>
		</Page>
	);
}
