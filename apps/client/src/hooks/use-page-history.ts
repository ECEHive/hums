import { useLocation } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";

const STORAGE_KEY = "hums:page-history";
const MAX_RECENT_VISITS = 20; // Only track last 20 visits per page
const MAX_TRACKED_PAGES = 30; // Maximum number of pages to track

type PageVisit = {
	path: string;
	recentVisits: number[]; // Timestamps of recent visits
	lastVisit: number;
};

type PageHistory = Record<string, PageVisit>;

// Pages to exclude from tracking (redirects, auth pages, etc.)
const EXCLUDED_PATHS = ["/", "/login", "/app", "/shifts"];

function getPageHistory(): PageHistory {
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		return stored ? JSON.parse(stored) : {};
	} catch {
		return {};
	}
}

function savePageHistory(history: PageHistory): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
	} catch {
		// Silently fail if localStorage is not available
	}
}

function shouldTrackPath(path: string): boolean {
	// Don't track exact matches of excluded paths or root paths
	if (EXCLUDED_PATHS.includes(path)) {
		return false;
	}
	// Don't track paths with query params or hash
	if (path.includes("?") || path.includes("#")) {
		return false;
	}
	return true;
}

function incrementPageVisit(path: string): void {
	if (!shouldTrackPath(path)) {
		return;
	}

	const history = getPageHistory();
	const now = Date.now();

	if (history[path]) {
		// Add new visit and keep only the last MAX_RECENT_VISITS
		history[path].recentVisits = [...history[path].recentVisits, now].slice(
			-MAX_RECENT_VISITS,
		);
		history[path].lastVisit = now;
	} else {
		history[path] = {
			path,
			recentVisits: [now],
			lastVisit: now,
		};
	}

	// Prune old pages if too many are tracked
	const entries = Object.values(history);
	if (entries.length > MAX_TRACKED_PAGES) {
		// Sort by last visit (ascending) and remove the least recently visited
		const sorted = entries.sort((a, b) => a.lastVisit - b.lastVisit);
		const toRemove = sorted.slice(0, entries.length - MAX_TRACKED_PAGES);
		for (const entry of toRemove) {
			delete history[entry.path];
		}
	}

	savePageHistory(history);
}

export function usePageHistory() {
	const location = useLocation();

	// Track current page visit
	useEffect(() => {
		const path = location.pathname;
		incrementPageVisit(path);
	}, [location.pathname]);

	// Get most visited page (excluding current page)
	const mostVisitedPage = useMemo(() => {
		const history = getPageHistory();
		const currentPath = location.pathname;

		const entries = Object.values(history)
			.filter(
				(entry) => entry.path !== currentPath && shouldTrackPath(entry.path),
			)
			.map((entry) => ({
				path: entry.path,
				count: entry.recentVisits.length, // Count is now based on recent visits only
				lastVisit: entry.lastVisit,
			}));

		if (entries.length === 0) {
			return null;
		}

		// Sort by count (descending), then by recency
		entries.sort((a, b) => {
			if (b.count !== a.count) {
				return b.count - a.count;
			}
			return b.lastVisit - a.lastVisit;
		});

		return entries[0];
	}, [location.pathname]);

	return {
		mostVisitedPage,
	};
}
