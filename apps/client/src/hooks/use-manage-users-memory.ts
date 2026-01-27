import { useCallback, useEffect } from "react";

const STORAGE_KEY = "hums:manage-users-last-visited";

type ManageUsersMemory = {
	userId: string;
	timestamp: number;
};

/**
 * Returns the last visited user ID in the Manage Users section,
 * or null if none has been visited or the memory has expired.
 */
export function getLastVisitedManageUser(): string | null {
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (!stored) return null;

		const memory: ManageUsersMemory = JSON.parse(stored);

		// Memory expires after 24 hours
		const ONE_DAY_MS = 24 * 60 * 60 * 1000;
		if (Date.now() - memory.timestamp > ONE_DAY_MS) {
			localStorage.removeItem(STORAGE_KEY);
			return null;
		}

		return memory.userId;
	} catch {
		return null;
	}
}

/**
 * Saves the currently visited user ID as the last visited in Manage Users.
 */
function setLastVisitedManageUser(userId: string): void {
	try {
		const memory: ManageUsersMemory = {
			userId,
			timestamp: Date.now(),
		};
		localStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
	} catch {
		// Silently fail if localStorage is not available
	}
}

/**
 * Clears the last visited user memory.
 */
export function clearManageUsersMemory(): void {
	try {
		localStorage.removeItem(STORAGE_KEY);
	} catch {
		// Silently fail if localStorage is not available
	}
}

/**
 * Hook to track and remember the last visited user in the Manage Users section.
 * Call this hook on the user detail page to remember the visit.
 */
export function useManageUsersMemory(userId?: string) {
	// Remember this user visit when the component mounts or userId changes
	useEffect(() => {
		if (userId) {
			setLastVisitedManageUser(userId);
		}
	}, [userId]);

	const clearMemory = useCallback(() => {
		clearManageUsersMemory();
	}, []);

	return {
		clearMemory,
	};
}
