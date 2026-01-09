import { useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { formatPageTitle, getPageTitle } from "@/lib/routeMetadata";

/**
 * Custom hook to automatically update the browser tab title based on the current URL path
 *
 * Uses the URL pathname to look up the page title from route metadata.
 * Formats the title as "HUMS - {Page Title}"
 *
 * @example
 * ```tsx
 * function MyPage() {
 *   usePageTitle(); // Will automatically set the page title based on current URL
 *   return <div>Content</div>;
 * }
 * ```
 */
export function usePageTitle() {
	const location = useLocation();
	const pathname = location.pathname;

	useEffect(() => {
		// Look up title based on URL path
		const title = getPageTitle(pathname);

		if (title) {
			document.title = formatPageTitle(title);
		} else {
			// Fallback to default title if no metadata found
			document.title = "HUMS - Hive User Management System";
		}
	}, [pathname]);
}
