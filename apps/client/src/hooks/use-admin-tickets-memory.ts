import { useCallback, useEffect } from "react";

const STORAGE_KEY = "hums:admin-tickets-last-visited";

type AdminTicketsMemory = {
	ticketId: string;
	timestamp: number;
};

/**
 * Returns the last visited ticket ID in the Admin Tickets section,
 * or null if none has been visited or the memory has expired.
 */
export function getLastVisitedAdminTicket(): string | null {
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (!stored) return null;

		const memory: AdminTicketsMemory = JSON.parse(stored);

		// Memory expires after 24 hours
		const ONE_DAY_MS = 24 * 60 * 60 * 1000;
		if (Date.now() - memory.timestamp > ONE_DAY_MS) {
			localStorage.removeItem(STORAGE_KEY);
			return null;
		}

		return memory.ticketId;
	} catch {
		return null;
	}
}

/**
 * Saves the currently visited ticket ID as the last visited in Admin Tickets.
 */
function setLastVisitedAdminTicket(ticketId: string): void {
	try {
		const memory: AdminTicketsMemory = {
			ticketId,
			timestamp: Date.now(),
		};
		localStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
	} catch {
		// Silently fail if localStorage is not available
	}
}

/**
 * Clears the last visited ticket memory.
 */
export function clearAdminTicketsMemory(): void {
	try {
		localStorage.removeItem(STORAGE_KEY);
	} catch {
		// Silently fail if localStorage is not available
	}
}

/**
 * Hook to track and remember the last visited ticket in the Admin Tickets section.
 * Call this hook on the ticket detail page to remember the visit.
 */
export function useAdminTicketsMemory(ticketId?: string) {
	// Remember this ticket visit when the component mounts or ticketId changes
	useEffect(() => {
		if (ticketId) {
			setLastVisitedAdminTicket(ticketId);
		}
	}, [ticketId]);

	const clearMemory = useCallback(() => {
		clearAdminTicketsMemory();
	}, []);

	return {
		clearMemory,
	};
}
