import { trpc } from "@ecehive/trpc/client";
import { useInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { VisibilityState } from "@tanstack/react-table";
import { Columns3Icon, Loader2Icon, RefreshCcwIcon } from "lucide-react";
import React from "react";
import { useAuth } from "@/auth/AuthProvider";
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
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useTableState } from "@/hooks/use-table-state";
import { checkPermissions } from "@/lib/permissions";

export const Route = createFileRoute("/app/inventory/items")({
	component: () => <Items />,
});

// How many items to load per request (the server allows up to 100)
const BATCH_SIZE = 100;

// Columns people can show or hide. Created is hidden by default since it's rarely useful.
const TOGGLEABLE_COLUMNS = [
	{ id: "sku", label: "SKU" },
	{ id: "location", label: "Location" },
	{ id: "minQuantity", label: "Min Qty" },
	{ id: "snapshot", label: "Quantity" },
	{ id: "created", label: "Created" },
	{ id: "updated", label: "Updated" },
];
const DEFAULT_HIDDEN: VisibilityState = {
	created: false,
};
const COLUMNS_STORAGE_KEY = "inventory-items-visible-columns";

// Remember each person's column choice in their browser
function loadColumnVisibility(): VisibilityState {
	try {
		const saved = localStorage.getItem(COLUMNS_STORAGE_KEY);
		if (saved) return { ...DEFAULT_HIDDEN, ...JSON.parse(saved) };
	} catch {
		// Storage blocked or bad data: use the defaults
	}
	return DEFAULT_HIDDEN;
}

export function Items() {
	// People who can't edit or delete items don't need the (empty) buttons column
	const { user } = useAuth();
	const canManageItems =
		checkPermissions(user, ["inventory.items.update"]) ||
		checkPermissions(user, ["inventory.items.delete"]);
	const [columnVisibility, setColumnVisibility] =
		React.useState<VisibilityState>(loadColumnVisibility);
	React.useEffect(() => {
		try {
			localStorage.setItem(
				COLUMNS_STORAGE_KEY,
				JSON.stringify(columnVisibility),
			);
		} catch {
			// Not saved; the choice just won't be remembered
		}
	}, [columnVisibility]);

	const { search, setSearch, debouncedSearch } = useTableState();

	// Filter states
	const [activeFilter, setActiveFilter] = React.useState<
		"active" | "inactive" | "all"
	>("active");
	const [showLowQuantity, setShowLowQuantity] = React.useState(false);
	// Kept stable between renders so the table doesn't redraw every row
	const tableColumnVisibility = React.useMemo(
		() => ({ ...columnVisibility, actions: canManageItems }),
		[columnVisibility, canManageItems],
	);

	const queryParams = React.useMemo(() => {
		return {
			search:
				debouncedSearch.trim() === "" ? undefined : debouncedSearch.trim(),
			limit: BATCH_SIZE,
			isActive: activeFilter === "all" ? undefined : activeFilter === "active",
			lowQuantity: showLowQuantity || undefined,
		};
	}, [debouncedSearch, activeFilter, showLowQuantity]);

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
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button variant="outline" className="gap-2">
										<Columns3Icon className="size-4" />
										Columns
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end" className="w-44">
									<DropdownMenuLabel>Show columns</DropdownMenuLabel>
									<DropdownMenuSeparator />
									{TOGGLEABLE_COLUMNS.map((column) => (
										<DropdownMenuCheckboxItem
											key={column.id}
											checked={columnVisibility[column.id] !== false}
											// Keep the menu open so several columns can be toggled
											onSelect={(e) => e.preventDefault()}
											onCheckedChange={(checked) =>
												setColumnVisibility((prev) => ({
													...prev,
													[column.id]: checked === true,
												}))
											}
										>
											{column.label}
										</DropdownMenuCheckboxItem>
									))}
								</DropdownMenuContent>
							</DropdownMenu>
						</div>
					</TableToolbar>

					<ItemsTable
						columns={columns}
						data={tableRows}
						totalCount={data.count}
						isLoading={isLoading}
						columnVisibility={tableColumnVisibility}
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
