import type React from "react";
import {
	Pagination,
	PaginationContent,
	PaginationEllipsis,
	PaginationItem,
	PaginationLink,
	PaginationNext,
	PaginationPrevious,
} from "@/components/ui/pagination";

export interface TablePaginationProps {
	page: number;
	totalPages: number;
	onPageChange: (page: number) => void;
	className?: string;
}

function getPageNumbers(page: number, totalPages: number) {
	const pages: (number | "ellipsis")[] = [];
	if (totalPages <= 7) {
		for (let i = 1; i <= totalPages; i++) pages.push(i);
	} else {
		if (page <= 4) {
			pages.push(1, 2, 3, 4, 5, "ellipsis", totalPages);
		} else if (page >= totalPages - 3) {
			pages.push(
				1,
				"ellipsis",
				totalPages - 4,
				totalPages - 3,
				totalPages - 2,
				totalPages - 1,
				totalPages,
			);
		} else {
			pages.push(
				1,
				"ellipsis",
				page - 1,
				page,
				page + 1,
				"ellipsis",
				totalPages,
			);
		}
	}
	return pages;
}

export const TablePagination: React.FC<TablePaginationProps> = ({
	page,
	totalPages,
	onPageChange,
	className,
}) => {
	return (
		<Pagination className={className}>
			<PaginationContent>
				<PaginationItem>
					<PaginationPrevious
						href="#"
						onClick={(e) => {
							e.preventDefault();
							if (page > 1) onPageChange(page - 1);
						}}
						aria-disabled={page === 1}
						tabIndex={page === 1 ? -1 : 0}
					/>
				</PaginationItem>
				{getPageNumbers(page, totalPages).map((p) =>
					p === "ellipsis" ? (
						<PaginationItem key={p}>
							<PaginationEllipsis />
						</PaginationItem>
					) : (
						<PaginationItem key={p}>
							<PaginationLink
								href="#"
								isActive={p === page}
								onClick={(e) => {
									e.preventDefault();
									onPageChange(Number(p));
								}}
							>
								{p}
							</PaginationLink>
						</PaginationItem>
					),
				)}
				<PaginationItem>
					<PaginationNext
						href="#"
						onClick={(e) => {
							e.preventDefault();
							if (page < totalPages) onPageChange(page + 1);
						}}
						aria-disabled={page === totalPages}
						tabIndex={page === totalPages ? -1 : 0}
					/>
				</PaginationItem>
			</PaginationContent>
		</Pagination>
	);
};
