/**
 * Centralized route metadata configuration
 *
 * This file contains all page titles and breadcrumb labels for the application.
 * Route IDs correspond to TanStack Router route IDs.
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
 * Map of route IDs to their metadata
 * Route IDs match TanStack Router's route structure (e.g., "/app/users", "/shifts/attendance")
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
	"/app/": {
		title: "Dashboard",
		breadcrumb: "Dashboard",
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
	"/app/periods": {
		title: "Periods",
		breadcrumb: "Periods",
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
	"/shifts": {
		title: "Shifts",
		breadcrumb: "Shifts",
	},
	"/shifts/": {
		title: "Shifts Dashboard",
		breadcrumb: "Dashboard",
	},
	"/shifts/shift-schedules": {
		title: "Shift Schedules",
		breadcrumb: "Shift Schedules",
	},
	"/shifts/scheduling": {
		title: "Scheduling",
		breadcrumb: "Scheduling",
	},
	"/shifts/shift-types": {
		title: "Shift Types",
		breadcrumb: "Shift Types",
	},
	"/shifts/period-exceptions": {
		title: "Period Exceptions",
		breadcrumb: "Period Exceptions",
	},
	"/shifts/period-details": {
		title: "Period Details",
		breadcrumb: "Period Details",
	},
	"/shifts/manage-users": {
		title: "Manage Users",
		breadcrumb: "Manage Users",
	},
	"/shifts/my-shifts": {
		title: "My Shifts",
		breadcrumb: "My Shifts",
	},
	"/shifts/attendance": {
		title: "Attendance",
		breadcrumb: "Attendance",
	},
	"/shifts/reports": {
		title: "Reports",
		breadcrumb: "Reports",
	},
};

/**
 * Get route metadata for a given route ID
 * @param routeId - The TanStack Router route ID
 * @returns Route metadata or undefined if not found
 */
export function getRouteMetadata(routeId: string): RouteMetadata | undefined {
	return routeMetadata[routeId];
}

/**
 * Get the page title for a route (without the "HUMS - " prefix)
 * @param routeId - The TanStack Router route ID
 * @returns Page title or undefined if not found
 */
export function getPageTitle(routeId: string): string | undefined {
	return routeMetadata[routeId]?.title;
}

/**
 * Get the breadcrumb label for a route
 * @param routeId - The TanStack Router route ID
 * @returns Breadcrumb label or undefined if not found
 */
export function getBreadcrumbLabel(routeId: string): string | undefined {
	return routeMetadata[routeId]?.breadcrumb;
}

/**
 * Format a page title with the HUMS prefix
 * @param title - The page title
 * @returns Formatted title string "HUMS - {title}"
 */
export function formatPageTitle(title: string): string {
	return `HUMS - ${title}`;
}
