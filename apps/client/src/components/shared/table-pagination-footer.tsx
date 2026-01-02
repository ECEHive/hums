import { TableFooter, TableInfo } from "@/components/layout";
import { PageSizeSelect } from "@/components/shared/page-size-select";
import { TablePagination } from "@/components/shared/table-pagination";

interface TablePaginationFooterProps {
	page: number;
	totalPages: number;
	onPageChange: (page: number) => void;
	offset: number;
	currentCount: number;
	total: number;
	itemName?: string;
	className?: string;
	pageSize: number;
	onPageSizeChange: (size: number) => void;
	pageSizeOptions?: number[];
}

/**
 * Complete table footer with pagination and info
 *
 * @example
 * ```tsx
 * <TablePaginationFooter
 *   page={page}
 *   totalPages={totalPages}
 *   onPageChange={setPage}
 *   offset={offset}
 *   currentCount={data.users.length}
 *   total={total}
 *   itemName="users"
 *   pageSize={pageSize}
 *   onPageSizeChange={setPageSize}
 * />
 * ```
 */
export function TablePaginationFooter({
	page,
	totalPages,
	onPageChange,
	offset,
	currentCount,
	total,
	itemName = "items",
	className,
	pageSize,
	onPageSizeChange,
	pageSizeOptions,
}: TablePaginationFooterProps) {
	return (
		<TableFooter className={className}>
			<TableInfo className="flex-1">
				Showing {offset + 1} - {offset + currentCount} of {total} {itemName}
			</TableInfo>
			<TablePagination
				page={page}
				totalPages={totalPages}
				onPageChange={onPageChange}
				className="flex-1 flex justify-center"
			/>
			<div className="flex-1 flex justify-end">
				<PageSizeSelect
					pageSize={pageSize}
					onPageSizeChange={onPageSizeChange}
					pageSizeOptions={pageSizeOptions}
				/>
			</div>
		</TableFooter>
	);
}
