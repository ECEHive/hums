import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	useReactTable,
} from "@tanstack/react-table";
import { cn } from "@/lib/utils";
import { Spinner } from "../ui/spinner";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "../ui/table";
import type { AuditLogRow } from "./types";

type AuditLogsDataTableProps = {
	columns: ColumnDef<AuditLogRow>[];
	data: AuditLogRow[];
	isLoading?: boolean;
	onRowClick?: (row: AuditLogRow) => void;
	emptyMessage?: string;
};

export function AuditLogsDataTable({
	columns,
	data,
	isLoading = false,
	onRowClick,
	emptyMessage = "No audit logs match this filter.",
}: AuditLogsDataTableProps) {
	const table = useReactTable({
		data,
		columns,
		getCoreRowModel: getCoreRowModel(),
	});

	return (
		<div className="relative overflow-hidden rounded-md border">
			<Table>
				<TableHeader className="bg-muted/40">
					{table.getHeaderGroups().map((headerGroup) => (
						<TableRow key={headerGroup.id}>
							{headerGroup.headers.map((header) => {
								const meta = header.column.columnDef.meta as
									| { className?: string }
									| undefined;
								return (
									<TableHead key={header.id} className={cn(meta?.className)}>
										{header.isPlaceholder
											? null
											: flexRender(
													header.column.columnDef.header,
													header.getContext(),
												)}
									</TableHead>
								);
							})}
						</TableRow>
					))}
				</TableHeader>
				<TableBody>
					{isLoading ? (
						<TableRow>
							<TableCell colSpan={columns.length} className="h-24">
								<div className="flex items-center justify-center gap-2 text-muted-foreground">
									<Spinner className="size-5" /> Fetching audit logs...
								</div>
							</TableCell>
						</TableRow>
					) : table.getRowModel().rows.length ? (
						table.getRowModel().rows.map((row) => (
							<TableRow
								key={row.id}
								className={cn(onRowClick && "cursor-pointer")}
								onClick={() => {
									if (onRowClick) onRowClick(row.original);
								}}
							>
								{row.getVisibleCells().map((cell) => {
									const meta = cell.column.columnDef.meta as
										| { className?: string }
										| undefined;
									return (
										<TableCell key={cell.id} className={cn(meta?.className)}>
											{flexRender(
												cell.column.columnDef.cell,
												cell.getContext(),
											)}
										</TableCell>
									);
								})}
							</TableRow>
						))
					) : (
						<TableRow>
							<TableCell
								colSpan={columns.length}
								className="h-24 text-center text-muted-foreground"
							>
								{emptyMessage}
							</TableCell>
						</TableRow>
					)}
				</TableBody>
			</Table>
		</div>
	);
}
