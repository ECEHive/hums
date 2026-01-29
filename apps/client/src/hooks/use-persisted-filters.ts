import { useCallback, useEffect, useRef, useState } from "react";
import { clearFilters, loadFilters, saveFilters } from "@/lib/filter-storage";

const DEFAULT_TTL_MS = 15 * 60 * 1000; // 15 minutes

export type UsePersistedFiltersOptions<T> = {
	/**
	 * Unique key to identify this page's filters in storage.
	 * Should be a stable, unique identifier like the route path.
	 * Example: "attendance-issues", "manage-users", "audit-logs"
	 */
	pageKey: string;

	/**
	 * Default filter values to use when no stored filters exist or they've expired
	 */
	defaultFilters: T;

	/**
	 * Optional TTL in milliseconds (default: 15 minutes)
	 */
	ttlMs?: number;

	/**
	 * Optional callback when filters are restored from storage
	 */
	onRestore?: (filters: T) => void;
};

export type UsePersistedFiltersReturn<T> = {
	/**
	 * Current filter values
	 */
	filters: T;

	/**
	 * Update filters (will auto-persist)
	 */
	setFilters: React.Dispatch<React.SetStateAction<T>>;

	/**
	 * Reset filters to defaults and clear storage
	 */
	resetFilters: () => void;

	/**
	 * Whether filters were restored from storage on mount
	 */
	wasRestored: boolean;

	/**
	 * Manually clear persisted filters without resetting current state
	 */
	clearPersistedFilters: () => void;
};

/**
 * Hook for managing filter state with automatic persistence to localStorage.
 * Filters are saved automatically when changed and restored on page load.
 * Stored filters expire after 15 minutes (configurable).
 *
 * @example
 * ```tsx
 * type MyFilters = {
 *   search: string;
 *   status: string;
 *   userId: number | null;
 * };
 *
 * const defaultFilters: MyFilters = {
 *   search: "",
 *   status: "all",
 *   userId: null,
 * };
 *
 * function MyPage() {
 *   const { filters, setFilters, resetFilters } = usePersistedFilters({
 *     pageKey: "my-page",
 *     defaultFilters,
 *   });
 *
 *   return (
 *     <input
 *       value={filters.search}
 *       onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
 *     />
 *   );
 * }
 * ```
 */
export function usePersistedFilters<T extends Record<string, unknown>>({
	pageKey,
	defaultFilters,
	ttlMs = DEFAULT_TTL_MS,
	onRestore,
}: UsePersistedFiltersOptions<T>): UsePersistedFiltersReturn<T> {
	// Use refs to track initialization state
	const isInitialized = useRef(false);
	const wasRestoredRef = useRef(false);

	// Initialize state with either stored or default filters
	const [filters, setFiltersInternal] = useState<T>(() => {
		const stored = loadFilters<T>(pageKey);
		if (stored !== null) {
			wasRestoredRef.current = true;
			return stored;
		}
		return defaultFilters;
	});

	// Track if filters were restored for external use
	const [wasRestored] = useState(() => wasRestoredRef.current);

	// Call onRestore callback after initial mount if filters were restored
	useEffect(() => {
		if (wasRestoredRef.current && onRestore && !isInitialized.current) {
			onRestore(filters);
		}
		isInitialized.current = true;
	}, []); // eslint-disable-line react-hooks/exhaustive-deps

	// Persist filters to storage whenever they change (after initialization)
	useEffect(() => {
		if (isInitialized.current) {
			saveFilters(pageKey, filters, ttlMs);
		}
	}, [filters, pageKey, ttlMs]);

	// Wrapped setFilters that updates state (persistence happens via useEffect)
	const setFilters = useCallback<React.Dispatch<React.SetStateAction<T>>>(
		(action) => {
			setFiltersInternal(action);
		},
		[],
	);

	// Reset to defaults and clear storage
	const resetFilters = useCallback(() => {
		clearFilters(pageKey);
		setFiltersInternal(defaultFilters);
	}, [pageKey, defaultFilters]);

	// Clear storage without resetting current state
	const clearPersistedFilters = useCallback(() => {
		clearFilters(pageKey);
	}, [pageKey]);

	return {
		filters,
		setFilters,
		resetFilters,
		wasRestored,
		clearPersistedFilters,
	};
}
