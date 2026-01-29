/**
 * Filter Storage Utility
 *
 * A robust system for persisting filter/query state to localStorage with automatic expiration.
 * Filters are saved per-page and expire after 15 minutes of inactivity.
 */

const STORAGE_PREFIX = "hums:filters:";
const DEFAULT_TTL_MS = 15 * 60 * 1000; // 15 minutes

export type StoredFilter<T> = {
	value: T;
	timestamp: number;
	ttlMs: number;
};

/**
 * Generates a storage key for a specific page's filters
 */
export function getFilterStorageKey(pageKey: string): string {
	return `${STORAGE_PREFIX}${pageKey}`;
}

/**
 * Saves filter state to localStorage with expiration timestamp
 */
export function saveFilters<T>(
	pageKey: string,
	filters: T,
	ttlMs: number = DEFAULT_TTL_MS,
): void {
	try {
		const storageKey = getFilterStorageKey(pageKey);
		const stored: StoredFilter<T> = {
			value: filters,
			timestamp: Date.now(),
			ttlMs,
		};
		localStorage.setItem(storageKey, JSON.stringify(stored));
	} catch {
		// Silently fail if localStorage is not available or quota exceeded
	}
}

/**
 * Loads filter state from localStorage if not expired
 * Returns null if no stored filters, expired, or on error
 */
export function loadFilters<T>(pageKey: string): T | null {
	try {
		const storageKey = getFilterStorageKey(pageKey);
		const stored = localStorage.getItem(storageKey);

		if (!stored) return null;

		const parsed: StoredFilter<T> = JSON.parse(stored);

		// Check if expired
		const elapsed = Date.now() - parsed.timestamp;
		if (elapsed > parsed.ttlMs) {
			// Clean up expired entry
			localStorage.removeItem(storageKey);
			return null;
		}

		return parsed.value;
	} catch {
		return null;
	}
}

/**
 * Clears stored filters for a specific page
 */
export function clearFilters(pageKey: string): void {
	try {
		const storageKey = getFilterStorageKey(pageKey);
		localStorage.removeItem(storageKey);
	} catch {
		// Silently fail
	}
}

/**
 * Clears all stored filters across all pages
 */
export function clearAllFilters(): void {
	try {
		const keysToRemove: string[] = [];
		for (let i = 0; i < localStorage.length; i++) {
			const key = localStorage.key(i);
			if (key?.startsWith(STORAGE_PREFIX)) {
				keysToRemove.push(key);
			}
		}
		for (const key of keysToRemove) {
			localStorage.removeItem(key);
		}
	} catch {
		// Silently fail
	}
}

/**
 * Checks if stored filters exist and are not expired
 */
export function hasValidFilters(pageKey: string): boolean {
	return loadFilters(pageKey) !== null;
}

/**
 * Updates the timestamp on stored filters to extend expiration
 * Useful when user interacts with filters without changing values
 */
export function touchFilters(pageKey: string): void {
	try {
		const storageKey = getFilterStorageKey(pageKey);
		const stored = localStorage.getItem(storageKey);

		if (!stored) return;

		const parsed: StoredFilter<unknown> = JSON.parse(stored);
		parsed.timestamp = Date.now();
		localStorage.setItem(storageKey, JSON.stringify(parsed));
	} catch {
		// Silently fail
	}
}
