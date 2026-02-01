/**
 * Unified Navigation Configuration
 *
 * This file centralizes all navigation configuration for the app,
 * including sub-apps (modules), their routes, and permissions.
 */

import {
	AlertCircleIcon,
	BanIcon,
	CalendarCheckIcon,
	CalendarIcon,
	CalendarXIcon,
	CameraIcon,
	ClipboardListIcon,
	ClockIcon,
	FileClockIcon,
	FileTextIcon,
	HistoryIcon,
	HomeIcon,
	InboxIcon,
	KeyIcon,
	LaptopMinimalCheckIcon,
	LayoutDashboardIcon,
	ListIcon,
	NotebookTextIcon,
	PackageIcon,
	PackageSearchIcon,
	PlusCircleIcon,
	ScrollTextIcon,
	SettingsIcon,
	ShieldCheckIcon,
	ShieldIcon,
	TicketIcon,
	UserIcon,
} from "lucide-react";
import type { RequiredPermissions } from "@/lib/permissions";

export type NavItem = {
	title: string;
	url: string;
	icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
	permissions: RequiredPermissions;
	allowWithShiftAccess?: boolean;
	external?: boolean;
	description?: string;
};

export type NavGroup = {
	name?: string;
	items: NavItem[];
};

export type AppModule = {
	id: string;
	name: string;
	description: string;
	icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
	basePath: string;
	color: string;
	permissions: RequiredPermissions;
	allowWithShiftAccess?: boolean;
	groups: NavGroup[];
};

/**
 * Main app modules (sub-apps) configuration
 */
export const appModules: AppModule[] = [
	{
		id: "dashboard",
		name: "Dashboard",
		description: "Overview and quick actions",
		icon: HomeIcon,
		basePath: "/app",
		color: "text-blue-500",
		permissions: [],
		groups: [
			{
				items: [
					{
						title: "Home",
						url: "/app",
						icon: HomeIcon,
						permissions: [],
						description: "Your personal dashboard",
					},
				],
			},
			{
				name: "Personal",
				items: [
					{
						title: "My Profile",
						url: "/app/me",
						icon: UserIcon,
						permissions: [],
						description: "View and edit your profile",
					},
					{
						title: "My Sessions",
						url: "/app/me/sessions",
						icon: ClockIcon,
						permissions: [],
						description: "View your session history",
					},
				],
			},
		],
	},
	{
		id: "shifts",
		name: "Shifts",
		description: "Manage your schedule",
		icon: CalendarIcon,
		basePath: "/app/shifts",
		color: "text-green-500",
		permissions: [],
		allowWithShiftAccess: true,
		groups: [
			{
				name: "My Shifts",
				items: [
					{
						title: "Overview",
						url: "/app/shifts",
						icon: HomeIcon,
						permissions: [],
						allowWithShiftAccess: true,
						description: "Shifts home",
					},
					{
						title: "Scheduling",
						url: "/app/shifts/scheduling",
						icon: CalendarIcon,
						permissions: [],
						allowWithShiftAccess: true,
						description: "Sign up for shifts",
					},
					{
						title: "My Shifts",
						url: "/app/shifts/my-shifts",
						icon: ClipboardListIcon,
						permissions: [],
						allowWithShiftAccess: true,
						description: "View your scheduled shifts",
					},
					{
						title: "Attendance",
						url: "/app/shifts/attendance",
						icon: CalendarCheckIcon,
						permissions: [],
						allowWithShiftAccess: true,
						description: "Your attendance history",
					},
				],
			},
			{
				name: "Administration",
				items: [
					{
						title: "Period Details",
						url: "/app/shifts/period-details",
						icon: CalendarIcon,
						permissions: { any: ["periods.update"] },
						description: "Configure period settings",
					},
					{
						title: "Period Exceptions",
						url: "/app/shifts/period-exceptions",
						icon: CalendarXIcon,
						permissions: { any: ["period_exceptions.list"] },
						description: "Manage schedule exceptions",
					},
					{
						title: "Shift Types",
						url: "/app/shifts/shift-types",
						icon: ListIcon,
						permissions: { any: ["shift_types.list"] },
						description: "Configure shift types",
					},
					{
						title: "Shift Schedules",
						url: "/app/shifts/shift-schedules",
						icon: ClockIcon,
						permissions: { any: ["shift_schedules.list"] },
						description: "Manage shift schedules",
					},
					{
						title: "Schedule Overview",
						url: "/app/shifts/schedule-overview",
						icon: LayoutDashboardIcon,
						permissions: { any: ["shift_schedules.list"] },
						description: "View all schedules",
					},
					{
						title: "Manage Users",
						url: "/app/shifts/manage-users",
						icon: ShieldCheckIcon,
						permissions: { any: ["shift_schedules.manipulate"] },
						description: "Manage user shift assignments",
					},
					{
						title: "Attendance Issues",
						url: "/app/shifts/attendance-issues",
						icon: AlertCircleIcon,
						permissions: { any: ["attendance.manage"] },
						description: "Review attendance problems",
					},
					{
						title: "Reports",
						url: "/app/shifts/reports",
						icon: NotebookTextIcon,
						permissions: { any: ["shift_reports.list"] },
						description: "Shift reports and analytics",
					},
				],
			},
		],
	},
	{
		id: "inventory",
		name: "Inventory",
		description: "Browse and manage items",
		icon: PackageIcon,
		basePath: "/app/inventory",
		color: "text-amber-500",
		permissions: [],
		groups: [
			{
				name: "Browse",
				items: [
					{
						title: "Overview",
						url: "/app/inventory",
						icon: HomeIcon,
						permissions: [],
						description: "Inventory home",
					},
					{
						title: "Items",
						url: "/app/inventory/items",
						icon: PackageSearchIcon,
						permissions: [],
						description: "Browse all items",
					},
					{
						title: "My Transactions",
						url: "/app/inventory/my-transactions",
						icon: HistoryIcon,
						permissions: [],
						description: "Your checkout history",
					},
				],
			},
			{
				name: "Administration",
				items: [
					{
						title: "All Transactions",
						url: "/app/inventory/transactions",
						icon: HistoryIcon,
						permissions: ["inventory.transactions.list"],
						description: "View all transactions",
					},
				],
			},
		],
	},
	{
		id: "tickets",
		name: "Tickets",
		description: "Support and requests",
		icon: TicketIcon,
		basePath: "/app/tickets",
		color: "text-purple-500",
		permissions: [],
		groups: [
			{
				name: "My Tickets",
				items: [
					{
						title: "Overview",
						url: "/app/tickets",
						icon: HomeIcon,
						permissions: [],
						description: "Tickets home",
					},
					{
						title: "Submit Ticket",
						url: "/submit",
						icon: PlusCircleIcon,
						permissions: [],
						external: true,
						description: "Create a new support ticket",
					},
					{
						title: "My Tickets",
						url: "/app/tickets/my-tickets",
						icon: TicketIcon,
						permissions: [],
						description: "View your tickets",
					},
				],
			},
			{
				name: "Administration",
				items: [
					{
						title: "All Tickets",
						url: "/app/tickets/admin",
						icon: InboxIcon,
						permissions: ["tickets.manage"],
						description: "Manage all tickets",
					},
					{
						title: "Ticket Types",
						url: "/app/tickets/admin/types",
						icon: SettingsIcon,
						permissions: ["tickets.types.manage"],
						description: "Configure ticket types",
					},
				],
			},
		],
	},
];

/**
 * Admin navigation items - shown in a separate section
 */
export const adminNavItems: NavGroup[] = [
	{
		name: "Users & Access",
		items: [
			{
				title: "Users",
				url: "/app/users",
				icon: UserIcon,
				permissions: { any: ["users.list"] },
				description: "Manage users",
			},
			{
				title: "Roles",
				url: "/app/roles",
				icon: ShieldIcon,
				permissions: { any: ["user_roles.list"] },
				description: "Manage roles and permissions",
			},
			{
				title: "Suspensions",
				url: "/app/suspensions",
				icon: BanIcon,
				permissions: { any: ["suspensions.list"] },
				description: "View and manage suspensions",
			},
			{
				title: "Agreements",
				url: "/app/agreements",
				icon: FileTextIcon,
				permissions: { any: ["agreements.list"] },
				description: "Manage user agreements",
			},
		],
	},
	{
		name: "System",
		items: [
			{
				title: "Devices",
				url: "/app/devices",
				icon: LaptopMinimalCheckIcon,
				permissions: { any: ["devices.list"] },
				description: "Manage registered devices",
			},
			{
				title: "API Tokens",
				url: "/app/api-tokens",
				icon: KeyIcon,
				permissions: { any: ["api_tokens.list"] },
				description: "Manage API access tokens",
			},
			{
				title: "Sessions",
				url: "/app/sessions",
				icon: FileClockIcon,
				permissions: { any: ["sessions.list"] },
				description: "View user sessions",
			},
			{
				title: "Security Snapshots",
				url: "/app/security",
				icon: CameraIcon,
				permissions: { any: ["security_snapshots.list"] },
				description: "Security camera snapshots",
			},
			{
				title: "Audit Logs",
				url: "/app/audit-logs",
				icon: ScrollTextIcon,
				permissions: { any: ["audit_logs.list"] },
				description: "View system audit logs",
			},
			{
				title: "Reports",
				url: "/app/reports",
				icon: ClipboardListIcon,
				permissions: { any: ["reports.list"] },
				description: "System reports",
			},
			{
				title: "Configuration",
				url: "/app/configuration",
				icon: SettingsIcon,
				permissions: { any: ["configuration.view"] },
				description: "System configuration",
			},
		],
	},
];

/**
 * Get the current app module based on pathname
 */
export function getCurrentModule(pathname: string): AppModule | null {
	// Find the most specific matching module
	const sortedModules = [...appModules].sort(
		(a, b) => b.basePath.length - a.basePath.length,
	);

	for (const module of sortedModules) {
		if (
			pathname === module.basePath ||
			pathname.startsWith(`${module.basePath}/`)
		) {
			return module;
		}
	}

	// Default to dashboard for /app routes
	if (pathname.startsWith("/app")) {
		return appModules.find((m) => m.id === "dashboard") ?? null;
	}

	return null;
}

/**
 * Check if a path is within the admin section
 */
export function isAdminPath(pathname: string): boolean {
	const adminPaths = [
		"/app/users",
		"/app/roles",
		"/app/suspensions",
		"/app/agreements",
		"/app/devices",
		"/app/api-tokens",
		"/app/sessions",
		"/app/security",
		"/app/audit-logs",
		"/app/reports",
		"/app/configuration",
	];

	return adminPaths.some(
		(path) => pathname === path || pathname.startsWith(`${path}/`),
	);
}
