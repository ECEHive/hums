import { ChevronDownIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface PageSizeSelectProps {
	pageSize: number;
	onPageSizeChange: (size: number) => void;
	pageSizeOptions?: number[];
	className?: string;
}

/**
 * Standardized page size selector dropdown
 *
 * @example
 * ```tsx
 * <PageSizeSelect
 *   pageSize={pageSize}
 *   onPageSizeChange={(size) => {
 *     setPageSize(size);
 *     setPage(1);
 *   }}
 * />
 * ```
 */
export function PageSizeSelect({
	pageSize,
	onPageSizeChange,
	pageSizeOptions = [10, 25, 50, 100],
	className,
}: PageSizeSelectProps) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="outline" className={className}>
					{pageSize} per page <ChevronDownIcon className="ml-2 size-4" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				{pageSizeOptions.map((size) => (
					<DropdownMenuItem key={size} onClick={() => onPageSizeChange(size)}>
						{size} per page
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
