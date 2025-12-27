import { TableFooter, TableInfo } from "@/components/layout";
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
}: TablePaginationFooterProps) {
	return (
		<TableFooter className={className}>
			<TableInfo>
				Showing {offset + 1} - {offset + currentCount} of {total} {itemName}
			</TableInfo>
			<TablePagination
				page={page}
				totalPages={totalPages}
				onPageChange={onPageChange}
			/>
		</TableFooter>
	);
}
