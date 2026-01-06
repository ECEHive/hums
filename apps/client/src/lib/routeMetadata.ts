/**
 * Centralized route metadata configuration
 *
 * This file contains all page titles and breadcrumb labels for the application.
 * Keys are URL paths (not internal route IDs).
 *
 * Format:
 * - title: Used for browser tab title (will be prefixed with "HUMS - ")
 * - breadcrumb: Used for breadcrumb navigation display
 */

export interface RouteMetadata {
	title: string;
	breadcrumb: string;
}

/**
 * Map of URL paths to their metadata
 * Keys should match the actual URL paths users see in the browser
 */
export const routeMetadata: Record<string, RouteMetadata> = {
	// Root and Auth Routes
	"/": {
		title: "Home",
		breadcrumb: "Home",
	},
	"/login": {
		title: "Login",
		breadcrumb: "Login",
	},
	"/ota-session-login": {
		title: "One-Time Session Login",
		breadcrumb: "OTA Login",
	},

	// App Routes
	"/app": {
		title: "Home",
		breadcrumb: "Home",
	},
	"/app/users": {
		title: "Users",
		breadcrumb: "Users",
	},
	"/app/kiosks": {
		title: "Kiosks",
		breadcrumb: "Kiosks",
	},
	"/app/roles": {
		title: "Roles",
		breadcrumb: "Roles",
	},
	"/app/sessions": {
		title: "Sessions",
		breadcrumb: "Sessions",
	},
	"/app/my-sessions": {
		title: "My Sessions",
		breadcrumb: "My Sessions",
	},
	"/app/my-agreements": {
		title: "My Agreements",
		breadcrumb: "My Agreements",
	},
	"/app/agreements": {
		title: "Agreements",
		breadcrumb: "Agreements",
	},
	"/app/api-tokens": {
		title: "API Tokens",
		breadcrumb: "API Tokens",
	},
	"/app/audit-logs": {
		title: "Audit Logs",
		breadcrumb: "Audit Logs",
	},
	"/app/suspensions": {
		title: "Suspensions",
		breadcrumb: "Suspensions",
	},
	"/app/configuration": {
		title: "Configuration",
		breadcrumb: "Configuration",
	},

	// Shifts Routes
	"/app/shifts": {
		title: "Shifts",
		breadcrumb: "Shifts",
	},
	"/app/shifts/shift-schedules": {
		title: "Shift Schedules",
		breadcrumb: "Shift Schedules",
	},
	"/app/shifts/scheduling": {
		title: "Scheduling",
		breadcrumb: "Scheduling",
	},
	"/app/shifts/shift-types": {
		title: "Shift Types",
		breadcrumb: "Shift Types",
	},
	"/app/shifts/period-exceptions": {
		title: "Period Exceptions",
		breadcrumb: "Period Exceptions",
	},
	"/app/shifts/period-details": {
		title: "Period Details",
		breadcrumb: "Period Details",
	},
	"/app/shifts/manage-users": {
		title: "Manage Users",
		breadcrumb: "Manage Users",
	},
	"/app/shifts/my-shifts": {
		title: "My Shifts",
		breadcrumb: "My Shifts",
	},
	"/app/shifts/attendance": {
		title: "Attendance",
		breadcrumb: "Attendance",
	},
	"/app/shifts/reports": {
		title: "Reports",
		breadcrumb: "Reports",
	},
};

/**
 * Get route metadata for a given URL path
 * @param path - The URL path (e.g., "/app/users")
 * @returns Route metadata or undefined if not found
 */
export function getRouteMetadata(path: string): RouteMetadata | undefined {
	return routeMetadata[path];
}

/**
 * Get the page title for a URL path (without the "HUMS - " prefix)
 * @param path - The URL path
 * @returns Page title or undefined if not found
 */
export function getPageTitle(path: string): string | undefined {
	return routeMetadata[path]?.title;
}

/**
 * Get the breadcrumb label for a URL path
 * @param path - The URL path
 * @returns Breadcrumb label or undefined if not found
 */
export function getBreadcrumbLabel(path: string): string | undefined {
	return routeMetadata[path]?.breadcrumb;
}

/**
 * Format a page title with the HUMS prefix
 * @param title - The page title
 * @returns Formatted title string "HUMS - {title}"
 */
export function formatPageTitle(title: string): string {
	return `HUMS - ${title}`;
}
