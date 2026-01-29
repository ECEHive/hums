import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDebounce } from "@/lib/debounce";
import { clearFilters, loadFilters, saveFilters } from "@/lib/filter-storage";

const DEFAULT_TTL_MS = 15 * 60 * 1000; // 15 minutes

type StoredTableState<TFilters> = {
	search: string;
	page: number;
	pageSize: number;
	filters: TFilters | null;
};

export interface UsePersistedTableStateOptions<
	TFilters = Record<string, unknown>,
> {
	/**
	 * Unique key to identify this page's state in storage.
	 * Should be a stable, unique identifier like the route path.
	 */
	pageKey: string;

	/**
	 * Initial page number (default: 1)
	 */
	initialPage?: number;

	/**
	 * Initial page size (default: 10)
	 */
	initialPageSize?: number;

	/**
	 * Initial search value (default: "")
	 */
	initialSearch?: string;

	/**
	 * Default filter values
	 */
	defaultFilters?: TFilters;

	/**
	 * TTL in milliseconds (default: 15 minutes)
	 */
	ttlMs?: number;

	/**
	 * Callback when state is restored from storage
	 */
	onRestore?: (state: { search: string; filters: TFilters | null }) => void;
}

export interface UsePersistedTableStateReturn<TFilters> {
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

	// Filters
	filters: TFilters | null;
	setFilters: React.Dispatch<React.SetStateAction<TFilters | null>>;

	// Helpers
	resetToFirstPage: () => void;
	resetAll: () => void;

	// Persistence state
	wasRestored: boolean;
}

/**
 * Enhanced table state hook with automatic persistence to localStorage.
 * Combines pagination, search, and filter state with 15-minute expiration.
 *
 * This hook is designed for tables that have filters beyond basic search.
 * For tables with only search, use regular useTableState.
 *
 * @example
 * ```tsx
 * type MyFilters = {
 *   status: string;
 *   roleIds: number[];
 * };
 *
 * const defaultFilters: MyFilters = {
 *   status: "all",
 *   roleIds: [],
 * };
 *
 * function MyPage() {
 *   const {
 *     page, setPage,
 *     pageSize, setPageSize,
 *     search, setSearch,
 *     debouncedSearch,
 *     filters, setFilters,
 *     resetToFirstPage,
 *     resetAll,
 *   } = usePersistedTableState({
 *     pageKey: "my-page",
 *     defaultFilters,
 *     initialPageSize: 20,
 *   });
 *
 *   // ...
 * }
 * ```
 */
export function usePersistedTableState<
	TFilters extends Record<string, unknown> = Record<string, unknown>,
>({
	pageKey,
	initialPage = 1,
	initialPageSize = 10,
	initialSearch = "",
	defaultFilters,
	ttlMs = DEFAULT_TTL_MS,
	onRestore,
}: UsePersistedTableStateOptions<TFilters>): UsePersistedTableStateReturn<TFilters> {
	const isInitialized = useRef(false);
	const wasRestoredRef = useRef(false);

	// Initialize state from storage or defaults
	const [stateFromStorage] = useState<StoredTableState<TFilters> | null>(() => {
		const stored = loadFilters<StoredTableState<TFilters>>(pageKey);
		if (stored !== null) {
			wasRestoredRef.current = true;
			return stored;
		}
		return null;
	});

	const [page, setPage] = useState(stateFromStorage?.page ?? initialPage);
	const [pageSize, setPageSize] = useState(
		stateFromStorage?.pageSize ?? initialPageSize,
	);
	const [search, setSearch] = useState(
		stateFromStorage?.search ?? initialSearch,
	);
	const [filters, setFiltersInternal] = useState<TFilters | null>(
		stateFromStorage?.filters ?? defaultFilters ?? null,
	);

	const [wasRestored] = useState(() => wasRestoredRef.current);
	const debouncedSearch = useDebounce(search, 300);
	const offset = useMemo(() => (page - 1) * pageSize, [page, pageSize]);

	// Call onRestore callback after mount if state was restored
	useEffect(() => {
		if (wasRestoredRef.current && onRestore && !isInitialized.current) {
			onRestore({
				search: stateFromStorage?.search ?? initialSearch,
				filters: stateFromStorage?.filters ?? null,
			});
		}
		isInitialized.current = true;
	}, []); // eslint-disable-line react-hooks/exhaustive-deps

	// Persist state to storage whenever it changes
	useEffect(() => {
		if (isInitialized.current) {
			const state: StoredTableState<TFilters> = {
				search,
				page,
				pageSize,
				filters,
			};
			saveFilters(pageKey, state, ttlMs);
		}
	}, [search, page, pageSize, filters, pageKey, ttlMs]);

	const resetToFirstPage = useCallback(() => setPage(1), []);

	const setFilters = useCallback<
		React.Dispatch<React.SetStateAction<TFilters | null>>
	>((action) => {
		setFiltersInternal(action);
	}, []);

	const resetAll = useCallback(() => {
		clearFilters(pageKey);
		setPage(initialPage);
		setPageSize(initialPageSize);
		setSearch(initialSearch);
		setFiltersInternal(defaultFilters ?? null);
	}, [pageKey, initialPage, initialPageSize, initialSearch, defaultFilters]);

	return {
		page,
		setPage,
		pageSize,
		setPageSize,
		offset,
		search,
		setSearch,
		debouncedSearch,
		filters,
		setFilters,
		resetToFirstPage,
		resetAll,
		wasRestored,
	};
}
