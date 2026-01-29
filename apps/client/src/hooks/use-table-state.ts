import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDebounce } from "@/lib/debounce";
import { loadFilters, saveFilters } from "@/lib/filter-storage";

const DEFAULT_TTL_MS = 15 * 60 * 1000; // 15 minutes

type PersistedTableState = {
	search: string;
	page: number;
	pageSize: number;
};

interface UseTableStateOptions {
	initialPage?: number;
	initialPageSize?: number;
	initialSearch?: string;
	/**
	 * Optional: Enable persistence to localStorage.
	 * Provide a unique key to identify this page's state.
	 */
	persistKey?: string;
	/**
	 * TTL in milliseconds for persisted state (default: 15 minutes)
	 */
	persistTtlMs?: number;
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
 * // Without persistence:
 * const {
 *   page, setPage,
 *   pageSize, setPageSize,
 *   offset,
 *   search, setSearch,
 *   debouncedSearch,
 *   resetToFirstPage
 * } = useTableState();
 *
 * // With persistence (saved for 15 minutes):
 * const { ... } = useTableState({
 *   persistKey: "my-page",
 *   initialPageSize: 20,
 * });
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
	const {
		initialPage = 1,
		initialPageSize = 10,
		initialSearch = "",
		persistKey,
		persistTtlMs = DEFAULT_TTL_MS,
	} = options;

	const isInitialized = useRef(false);

	// Load initial state from storage if persistence is enabled
	const storedState = useMemo(() => {
		if (!persistKey) return null;
		return loadFilters<PersistedTableState>(persistKey);
	}, [persistKey]);

	const [page, setPageInternal] = useState(storedState?.page ?? initialPage);
	const [pageSize, setPageSizeInternal] = useState(
		storedState?.pageSize ?? initialPageSize,
	);
	const [search, setSearchInternal] = useState(
		storedState?.search ?? initialSearch,
	);

	const debouncedSearch = useDebounce(search, 300);
	const offset = useMemo(() => (page - 1) * pageSize, [page, pageSize]);

	// Mark as initialized after first render
	useEffect(() => {
		isInitialized.current = true;
	}, []);

	// Persist state when it changes (if persistence is enabled)
	useEffect(() => {
		if (!persistKey || !isInitialized.current) return;

		const state: PersistedTableState = {
			search,
			page,
			pageSize,
		};
		saveFilters(persistKey, state, persistTtlMs);
	}, [search, page, pageSize, persistKey, persistTtlMs]);

	const setPage = useCallback((newPage: number) => {
		setPageInternal(newPage);
	}, []);

	const setPageSize = useCallback((newSize: number) => {
		setPageSizeInternal(newSize);
	}, []);

	const setSearch = useCallback((newSearch: string) => {
		setSearchInternal(newSearch);
	}, []);

	const resetToFirstPage = useCallback(() => setPageInternal(1), []);

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
