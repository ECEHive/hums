import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	getSortedRowModel,
	type Row,
	type SortingFn,
	type SortingState,
	useReactTable,
	type VisibilityState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import React from "react";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { ItemRow } from "./types";

// Each column's share of the table width. Shares are split among the columns
// currently shown, so the layout stays balanced as columns are hidden or shown.
// Widths are fixed per layout, so columns don't shift while scrolling.
const COLUMN_SHARES: Record<string, number> = {
	name: 3,
	sku: 1.2,
	location: 2,
	minQuantity: 0.8,
	snapshot: 0.8,
	created: 1.2,
	updated: 1.2,
};
// The Edit/Delete buttons only need a fixed sliver of space
const ACTIONS_WIDTH = 88;

/** Numbers compare as numbers, text naturally ("Bench 2" before "Bench 10"). */
const naturalSort: SortingFn<ItemRow> = (rowA, rowB, columnId) => {
	const a = rowA.getValue<string | number>(columnId);
	const b = rowB.getValue<string | number>(columnId);
	if (typeof a === "number" && typeof b === "number") return a - b;
	return String(a).localeCompare(String(b), undefined, {
		numeric: true,
		sensitivity: "base",
	});
};

// Default view: by location, then by name within each location
const DEFAULT_SORT: SortingState = [
	{ id: "location", desc: false },
	{ id: "name", desc: false },
];

const ESTIMATED_ROW_HEIGHT = 37;

// Compact rows like Airtable: less padding, smaller row buttons, icons never squished
const ROW_CLASS = "[&_button]:size-7 [&_svg]:shrink-0";
const CELL_CLASS = "truncate py-1";

interface ItemsTableProps {
	columns: ColumnDef<ItemRow>[];
	data: ItemRow[];
	/** Total matching items, including ones still loading (shown as placeholders) */
	totalCount: number;
	isLoading?: boolean;
	/** Which columns are shown, by column id (false = hidden) */
	columnVisibility?: VisibilityState;
}

/**
 * Items table that only draws the rows on screen, so long lists scroll smoothly.
 * The header stays pinned to the top of the page while you scroll.
 * Nothing here may set overflow, or the sticky header stops working.
 */
export function ItemsTable({
	columns,
	data,
	totalCount,
	isLoading = false,
	columnVisibility = {},
}: ItemsTableProps) {
	// Click a header: ascending, then descending, then back to the default order
	const [sorting, setSorting] = React.useState<SortingState>(DEFAULT_SORT);

	const table = useReactTable({
		data,
		columns,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		// Clearing a column's sort goes back to the default order, not an unsorted list
		onSortingChange: (updater) =>
			setSorting((prev) => {
				const next = typeof updater === "function" ? updater(prev) : updater;
				return next.length > 0 ? next : DEFAULT_SORT;
			}),
		state: { sorting, columnVisibility },
		// Empty values (no SKU, no Min Qty, not counted) always go to the bottom
		defaultColumn: { sortingFn: naturalSort, sortUndefined: "last" },
	});
	const rows = table.getRowModel().rows;

	// The page scrolls inside <main>, not the window
	const tableRef = React.useRef<HTMLTableElement>(null);
	const [scrollElement, setScrollElement] = React.useState<HTMLElement | null>(
		null,
	);
	// How far down the scroll area the table starts (title, search bar, etc. above it)
	const [scrollMargin, setScrollMargin] = React.useState(0);

	React.useLayoutEffect(() => {
		const main = tableRef.current?.closest("main") ?? null;
		setScrollElement(main);
		if (!main) return;

		const measure = () => {
			if (!tableRef.current) return;
			const offset =
				tableRef.current.getBoundingClientRect().top -
				main.getBoundingClientRect().top +
				main.scrollTop;
			setScrollMargin(offset);
		};
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(main);
		return () => observer.disconnect();
	}, []);

	const virtualizer = useVirtualizer({
		count: Math.max(totalCount, rows.length),
		getScrollElement: () => scrollElement,
		estimateSize: () => ESTIMATED_ROW_HEIGHT,
		// Draw a few extra rows above and below the screen so fast scrolling doesn't show blank space
		overscan: 20,
		scrollMargin,
	});

	const virtualRows = virtualizer.getVirtualItems();
	const first = virtualRows[0];
	const last = virtualRows[virtualRows.length - 1];
	// Empty space above/below the drawn rows, so the scrollbar matches the full list
	const paddingTop = first ? first.start - scrollMargin : 0;
	const paddingBottom = last
		? virtualizer.getTotalSize() - (last.end - scrollMargin)
		: 0;

	const visibleColumns = table.getVisibleLeafColumns();
	// Changes when columns are shown or hidden, so rows know to redraw
	const columnsKey = visibleColumns.map((column) => column.id).join(",");
	const totalShares = visibleColumns.reduce(
		(sum, column) => sum + (COLUMN_SHARES[column.id] ?? 0),
		0,
	);
	const widthOf = (columnId: string) =>
		columnId === "actions"
			? ACTIONS_WIDTH
			: `${((COLUMN_SHARES[columnId] ?? 1) / totalShares) * 100}%`;

	return (
		<div className="rounded-md border">
			<table ref={tableRef} className="w-full table-fixed text-sm">
				{/* Inset shadow instead of a border: borders don't stick with the header */}
				<TableHeader className="sticky top-0 z-10 bg-muted shadow-[inset_0_-1px_0_var(--border)] [&_tr]:border-b-0 [&_th:first-child]:rounded-tl-md [&_th:last-child]:rounded-tr-md">
					{table.getHeaderGroups().map((headerGroup) => (
						<TableRow key={headerGroup.id} className="hover:bg-transparent">
							{headerGroup.headers.map((header) => {
								const style = { width: widthOf(header.column.id) };
								if (header.isPlaceholder) {
									return <TableHead key={header.id} style={style} />;
								}
								const content = flexRender(
									header.column.columnDef.header,
									header.getContext(),
								);
								if (!header.column.getCanSort()) {
									return (
										<TableHead key={header.id} style={style}>
											{content}
										</TableHead>
									);
								}
								const sorted = header.column.getIsSorted();
								const SortIcon =
									sorted === "asc"
										? ArrowUp
										: sorted === "desc"
											? ArrowDown
											: ArrowUpDown;
								return (
									<TableHead
										key={header.id}
										style={style}
										aria-sort={
											sorted === "asc"
												? "ascending"
												: sorted === "desc"
													? "descending"
													: "none"
										}
									>
										<button
											type="button"
											onClick={header.column.getToggleSortingHandler()}
											className="-ml-2 inline-flex items-center gap-1 rounded px-2 py-1 hover:bg-accent hover:text-accent-foreground"
										>
											{content}
											<SortIcon
												className={`size-3.5 ${sorted ? "" : "text-muted-foreground/60"}`}
											/>
										</button>
									</TableHead>
								);
							})}
						</TableRow>
					))}
				</TableHeader>
				<TableBody>
					{isLoading ? (
						<TableRow>
							<TableCell colSpan={columns.length} className="h-32 p-0">
								<div className="flex h-full items-center justify-center">
									<Spinner className="size-8 text-primary" />
								</div>
							</TableCell>
						</TableRow>
					) : virtualRows.length === 0 ? (
						<TableRow>
							<TableCell colSpan={columns.length} className="h-32 p-0">
								<Empty className="border-0 p-6">
									<EmptyHeader>
										<EmptyContent>
											<EmptyTitle>No items found</EmptyTitle>
											<EmptyDescription>
												Try adjusting your search
											</EmptyDescription>
										</EmptyContent>
									</EmptyHeader>
								</Empty>
							</TableCell>
						</TableRow>
					) : (
						<>
							{paddingTop > 0 && (
								<tr aria-hidden style={{ height: paddingTop }} />
							)}
							{virtualRows.map((virtualRow) => {
								const row = rows[virtualRow.index];
								// Not loaded yet: show a placeholder row
								if (!row) {
									return (
										<TableRow
											key={`placeholder-${virtualRow.index}`}
											data-index={virtualRow.index}
											ref={virtualizer.measureElement}
											className="h-9"
										>
											{visibleColumns.map((column) => (
												<TableCell key={column.id} className={CELL_CLASS}>
													<Skeleton className="h-4 w-3/4" />
												</TableCell>
											))}
										</TableRow>
									);
								}
								return (
									<ItemTableRow
										key={row.id}
										row={row}
										index={virtualRow.index}
										measureRef={virtualizer.measureElement}
										columnsKey={columnsKey}
									/>
								);
							})}
							{paddingBottom > 0 && (
								<tr aria-hidden style={{ height: paddingBottom }} />
							)}
						</>
					)}
				</TableBody>
			</table>
		</div>
	);
}

interface ItemTableRowProps {
	row: Row<ItemRow>;
	index: number;
	measureRef: (element: HTMLTableRowElement | null) => void;
	columnsKey: string;
}

// Rows already on screen skip redrawing while scrolling, so only the rows
// that just scrolled into view get built
const ItemTableRow = React.memo(function ItemTableRow({
	row,
	index,
	measureRef,
}: ItemTableRowProps) {
	return (
		<TableRow data-index={index} ref={measureRef} className={ROW_CLASS}>
			{row.getVisibleCells().map((cell) => (
				<TableCell key={cell.id} className={CELL_CLASS}>
					{flexRender(cell.column.columnDef.cell, cell.getContext())}
				</TableCell>
			))}
		</TableRow>
	);
});
