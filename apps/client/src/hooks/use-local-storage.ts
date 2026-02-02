import { useCallback, useEffect, useState } from "react";

/**
 * Hook for managing state that's persisted to localStorage.
 *
 * @param key - The localStorage key to use
 * @param initialValue - The initial value if nothing is stored
 * @returns A tuple of [value, setValue] similar to useState
 */
export function useLocalStorage<T>(
	key: string,
	initialValue: T,
): [T, (value: T | ((prev: T) => T)) => void] {
	// Get the initial value from localStorage or use the default
	const [storedValue, setStoredValue] = useState<T>(() => {
		try {
			const item = localStorage.getItem(key);
			return item ? JSON.parse(item) : initialValue;
		} catch {
			return initialValue;
		}
	});

	// Update localStorage when the value changes
	useEffect(() => {
		try {
			localStorage.setItem(key, JSON.stringify(storedValue));
		} catch {
			// Silently fail if localStorage is not available
		}
	}, [key, storedValue]);

	// Wrapper around setStoredValue that also updates localStorage
	const setValue = useCallback((value: T | ((prev: T) => T)) => {
		setStoredValue((prev) => {
			const newValue = value instanceof Function ? value(prev) : value;
			return newValue;
		});
	}, []);

	return [storedValue, setValue];
}
