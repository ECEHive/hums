import type { KioskMode } from "@ecehive/prisma";
import type { ComponentType } from "react";

/**
 * A successfully parsed card scan result.
 *
 * Structurally compatible with `CardScan` from `@ecehive/card-scanner`.
 * Defined locally here so that the core package has no browser-only
 * dependencies.
 */
export interface CardScan {
	/** Unique scan identifier (nanoid). */
	id: string;
	/** The parsed credential value (e.g. normalised card number). */
	data: string;
	/** When the scan was received. */
	timestamp: Date;
}

// ---------------------------------------------------------------------------
// Kiosk runtime types
// ---------------------------------------------------------------------------

/**
 * Runtime configuration injected into every kiosk mode component.
 *
 * Values are fetched from the server at runtime so that the kiosk can be
 * pre-built as a static bundle without build-time environment variables.
 */
export interface KioskConfig {
	/** Authentication provider type. */
	authProvider: "CAS" | "CAS_PROXIED";
	/** CAS login URL (used when authProvider is "CAS"). */
	casLoginUrl: string | null;
	/** CAS proxy URL (used when authProvider is "CAS_PROXIED"). */
	casProxyUrl: string | null;
	/** Sentry DSN for kiosk error tracking (null if disabled). */
	kioskSentryDsn: string | null;
	/** Application timezone. */
	timezone: string;
	/** Client base URL for cross-app redirects. */
	clientBaseUrl: string | null;
}

/**
 * Device status returned by `trpc.devices.checkStatus`.
 *
 * The unified kiosk shell reads `kioskMode` to determine which plugin
 * component to render.
 */
export interface DeviceStatus {
	id: number;
	name: string;
	ipAddress: string;
	isActive: boolean;
	hasDashboardAccess: boolean;
	hasKioskAccess: boolean;
	hasInventoryAccess: boolean;
	hasControlAccess: boolean;
	/** Which kiosk mode this device is configured to display. */
	kioskMode: KioskMode | null;
}

/**
 * Props passed by the unified kiosk shell to every plugin kiosk component.
 *
 * The shell owns the card reader; plugins receive scan results and ask the
 * shell to clear them.
 */
export interface KioskModeProps {
	/** The most recent successful card scan, or `null` if none/cleared. */
	cardScan: CardScan | null;
	/** Call this to acknowledge a scan and reset it to `null`. */
	clearCardScan: () => void;
	/** Runtime configuration values fetched from the server. */
	config: KioskConfig;
	/** The current device record, including its `kioskMode` field. */
	device: DeviceStatus;
}

/**
 * Describes a single kiosk mode contributed by a plugin.
 */
export interface KioskModeDefinition {
	/** Must match the `KioskMode` enum value this component handles. */
	id: KioskMode;
	/**
	 * React component that implements the kiosk mode UI.
	 *
	 * Must accept {@link KioskModeProps}.
	 */
	component: ComponentType<KioskModeProps>;
}

/**
 * The kiosk manifest contributed by a plugin.
 *
 * Assign this to `HumsPlugin.kiosk` (cast as `unknown` on the server side;
 * import from `@ecehive/core/ui` on the kiosk side to get the typed version).
 */
export interface KioskManifest {
	modes: KioskModeDefinition[];
}

// ---------------------------------------------------------------------------
// Admin UI types
// ---------------------------------------------------------------------------

/**
 * A navigation item contributed to the admin app sidebar.
 */
export interface NavItemDefinition {
	/** Route path (relative to the admin app root). */
	path: string;
	/** Display label shown in the nav. */
	label: string;
	/** Optional icon name (Lucide icon name string). */
	icon?: string;
	/** Sort order — lower numbers appear first. Default: 100. */
	order?: number;
}

/**
 * A page contributed to the admin app.
 */
export interface AdminPageDefinition {
	/** Route path (relative to the admin app root). */
	path: string;
	/** Human-readable label (used in breadcrumbs and page titles). */
	label: string;
	/** React component to render when this route is active. */
	component: ComponentType;
	/** Optional inline nav item definition. Omit to exclude from the nav. */
	navItem?: Omit<NavItemDefinition, "path">;
}

/**
 * The admin client manifest contributed by a plugin.
 *
 * Assign this to `HumsPlugin.client` (cast as `unknown` on the server side;
 * import from `@ecehive/core/ui` on the client side to get the typed version).
 */
export interface PluginClientManifest {
	/** Pages to register in the admin TanStack Router. */
	pages: AdminPageDefinition[];
	/**
	 * Top-level nav items to inject into the sidebar.
	 *
	 * If omitted, nav items are derived from `pages[].navItem` only.
	 */
	navItems?: NavItemDefinition[];
}
