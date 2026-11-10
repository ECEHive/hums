import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	getSortedRowModel,
	type SortingFn,
	type SortingState,
	useReactTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useEffect, useState } from "react";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";

interface DataTableProps<TData, TValue> {
	columns: ColumnDef<TData, TValue>[];
	data: TData[];
	isLoading?: boolean;
	emptyMessage?: string;
	emptyDescription?: string;
	emptyIcon?: React.ReactNode;
	className?: string;
	/** Let users sort rows by clicking column headers (client-side) */
	enableSorting?: boolean;
	/** Called with the rows in their current display order */
	onSortedRowsChange?: (rows: TData[]) => void;
}

/** Turn a cell value into something comparable */
function normalizeValue(value: unknown): string | number | null {
	if (value === null || value === undefined || value === "") return null;
	if (value instanceof Date) return value.getTime();
	if (typeof value === "number") return Number.isNaN(value) ? null : value;
	if (typeof value === "boolean") return value ? 1 : 0;
	if (Array.isArray(value)) {
		const parts = value.map((v) =>
			v && typeof v === "object" && "name" in v ? String(v.name) : String(v),
		);
		return parts.length ? parts.join(", ") : null;
	}
	return String(value);
}

/** Sorts numbers, dates, and text naturally. Empty values sort first. */
const smartSort: SortingFn<unknown> = (rowA, rowB, columnId) => {
	const a = normalizeValue(rowA.getValue(columnId));
	const b = normalizeValue(rowB.getValue(columnId));
	if (a === null || b === null) return a === b ? 0 : a === null ? -1 : 1;
	if (typeof a === "number" && typeof b === "number") return a - b;
	return String(a).localeCompare(String(b), undefined, {
		numeric: true,
		sensitivity: "base",
	});
};

/**
 * Standardized data table component
 *
 * Provides consistent:
 * - Loading states with centered spinner
 * - Empty states with customizable messages
 * - Table styling and structure
 * - Responsive behavior
 *
 * @example
 * ```tsx
 * <DataTable
 *   columns={columns}
 *   data={users}
 *   isLoading={isLoading}
 *   emptyMessage="No users found"
 *   emptyDescription="Try adjusting your search or filters"
 * />
 * ```
 */
export function DataTable<TData, TValue>({
	columns,
	data,
	isLoading = false,
	emptyMessage = "No results",
	emptyDescription,
	emptyIcon,
	className,
	enableSorting = false,
	onSortedRowsChange,
}: DataTableProps<TData, TValue>) {
	const [sorting, setSorting] = useState<SortingState>([]);

	const table = useReactTable({
		data,
		columns,
		getCoreRowModel: getCoreRowModel(),
		enableSorting,
		...(enableSorting && {
			getSortedRowModel: getSortedRowModel(),
			onSortingChange: setSorting,
			defaultColumn: { sortingFn: smartSort as SortingFn<TData> },
		}),
		state: { sorting },
	});

	const sortedRows = table.getRowModel().rows;
	useEffect(() => {
		onSortedRowsChange?.(sortedRows.map((row) => row.original));
	}, [sortedRows, onSortedRowsChange]);

	return (
		<div className="overflow-hidden rounded-md border relative">
			<Table className={className}>
				<TableHeader className="bg-muted">
					{table.getHeaderGroups().map((headerGroup) => (
						<TableRow key={headerGroup.id}>
							{headerGroup.headers.map((header) => {
								if (header.isPlaceholder) {
									return <TableHead key={header.id} />;
								}
								const content = flexRender(
									header.column.columnDef.header,
									header.getContext(),
								);
								if (!header.column.getCanSort()) {
									return <TableHead key={header.id}>{content}</TableHead>;
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
								<div className="flex items-center justify-center h-full">
									<Spinner className="size-8 text-primary" />
								</div>
							</TableCell>
						</TableRow>
					) : sortedRows.length ? (
						sortedRows.map((row) => (
							<TableRow
								key={row.id}
								data-state={row.getIsSelected() && "selected"}
							>
								{row.getVisibleCells().map((cell) => (
									<TableCell key={cell.id}>
										{flexRender(cell.column.columnDef.cell, cell.getContext())}
									</TableCell>
								))}
							</TableRow>
						))
					) : (
						<TableRow>
							<TableCell colSpan={columns.length} className="h-32 p-0">
								<div className="flex items-center justify-center h-full p-6">
									<Empty className="border-0 p-0">
										<EmptyHeader>
											{emptyIcon && (
												<EmptyMedia variant="icon">{emptyIcon}</EmptyMedia>
											)}
											<EmptyContent>
												<EmptyTitle>{emptyMessage}</EmptyTitle>
												{emptyDescription && (
													<EmptyDescription>
														{emptyDescription}
													</EmptyDescription>
												)}
											</EmptyContent>
										</EmptyHeader>
									</Empty>
								</div>
							</TableCell>
						</TableRow>
					)}
				</TableBody>
			</Table>
		</div>
	);
}
