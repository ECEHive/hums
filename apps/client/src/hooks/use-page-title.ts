import { useMatches } from "@tanstack/react-router";
import { useEffect } from "react";
import { formatPageTitle, getPageTitle } from "@/lib/routeMetadata";

/**
 * Custom hook to automatically update the browser tab title based on the current route
 *
 * Finds the deepest route match and uses its title from the route metadata.
 * Formats the title as "HUMS - {Page Title}"
 *
 * @example
 * ```tsx
 * function MyPage() {
 *   usePageTitle(); // Will automatically set the page title
 *   return <div>Content</div>;
 * }
 * ```
 */
export function usePageTitle() {
	const matches = useMatches();

	useEffect(() => {
		// Get the deepest route match (last non-root route)
		const currentRoute = matches
			.filter((match) => match.routeId !== "__root__")
			.pop();

		if (currentRoute) {
			const title = getPageTitle(currentRoute.routeId);
			if (title) {
				document.title = formatPageTitle(title);
			} else {
				// Fallback to default title if no metadata found
				document.title = "HUMS - Hive User Management System";
			}
		} else {
			// Fallback for root route
			document.title = "HUMS - Hive User Management System";
		}
	}, [matches]);
}
