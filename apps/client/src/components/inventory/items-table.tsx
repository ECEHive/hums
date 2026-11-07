import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
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

// Fixed column widths, so columns don't shift as different rows scroll into view.
// Columns not listed (Name) take the remaining space.
const COLUMN_WIDTHS: Record<string, number> = {
	sku: 120,
	location: 200,
	minQuantity: 90,
	snapshot: 100,
	created: 130,
	updated: 130,
	actions: 100,
};

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
}: ItemsTableProps) {
	const table = useReactTable({
		data,
		columns,
		getCoreRowModel: getCoreRowModel(),
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
		overscan: 10,
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

	return (
		<div className="rounded-md border">
			<table ref={tableRef} className="w-full table-fixed text-sm">
				{/* Inset shadow instead of a border: borders don't stick with the header */}
				<TableHeader className="sticky top-0 z-10 bg-muted shadow-[inset_0_-1px_0_var(--border)] [&_tr]:border-b-0 [&_th:first-child]:rounded-tl-md [&_th:last-child]:rounded-tr-md">
					{table.getHeaderGroups().map((headerGroup) => (
						<TableRow key={headerGroup.id} className="hover:bg-transparent">
							{headerGroup.headers.map((header) => (
								<TableHead
									key={header.id}
									style={{ width: COLUMN_WIDTHS[header.column.id] }}
								>
									{header.isPlaceholder
										? null
										: flexRender(
												header.column.columnDef.header,
												header.getContext(),
											)}
								</TableHead>
							))}
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
									<TableRow
										key={row.id}
										data-index={virtualRow.index}
										ref={virtualizer.measureElement}
										className={ROW_CLASS}
									>
										{row.getVisibleCells().map((cell) => (
											<TableCell key={cell.id} className={CELL_CLASS}>
												{flexRender(
													cell.column.columnDef.cell,
													cell.getContext(),
												)}
											</TableCell>
										))}
									</TableRow>
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
