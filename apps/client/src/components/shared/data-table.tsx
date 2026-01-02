import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	useReactTable,
} from "@tanstack/react-table";
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
}

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
}: DataTableProps<TData, TValue>) {
	const table = useReactTable({
		data,
		columns,
		getCoreRowModel: getCoreRowModel(),
	});

	return (
		<div className="overflow-hidden rounded-md border relative">
			<Table className={className}>
				<TableHeader className="bg-muted">
					{table.getHeaderGroups().map((headerGroup) => (
						<TableRow key={headerGroup.id}>
							{headerGroup.headers.map((header) => (
								<TableHead key={header.id}>
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
								<div className="flex items-center justify-center h-full">
									<Spinner className="size-8 text-primary" />
								</div>
							</TableCell>
						</TableRow>
					) : table.getRowModel().rows?.length ? (
						table.getRowModel().rows.map((row) => (
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
