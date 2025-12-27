import { useMemo, useState } from "react";
import { useDebounce } from "@/lib/debounce";

interface UseTableStateOptions {
	initialPage?: number;
	initialPageSize?: number;
	initialSearch?: string;
}

interface UseTableStateReturn {
	// Pagination
	page: number;
	setPage: (page: number) => void;
	pageSize: number;
	setPageSize: (size: number) => void;
	offset: number;

	// Search
	search: string;
	setSearch: (search: string) => void;
	debouncedSearch: string;

	// Helper for resetting to page 1
	resetToFirstPage: () => void;
}

/**
 * Standard hook for managing table state (pagination, search)
 *
 * @example
 * ```tsx
 * const {
 *   page, setPage,
 *   pageSize, setPageSize,
 *   offset,
 *   search, setSearch,
 *   debouncedSearch,
 *   resetToFirstPage
 * } = useTableState();
 *
 * // In search handler:
 * onChange={(e) => {
 *   setSearch(e.target.value);
 *   resetToFirstPage();
 * }}
 * ```
 */
export function useTableState(
	options: UseTableStateOptions = {},
): UseTableStateReturn {
	const { initialPage = 1, initialPageSize = 10, initialSearch = "" } = options;

	const [page, setPage] = useState(initialPage);
	const [pageSize, setPageSize] = useState(initialPageSize);
	const [search, setSearch] = useState(initialSearch);

	const debouncedSearch = useDebounce(search, 300);

	const offset = useMemo(() => (page - 1) * pageSize, [page, pageSize]);

	const resetToFirstPage = () => setPage(1);

	return {
		page,
		setPage,
		pageSize,
		setPageSize,
		offset,
		search,
		setSearch,
		debouncedSearch,
		resetToFirstPage,
	};
}
