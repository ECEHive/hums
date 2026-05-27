import type { ILogObj, Logger } from "@ecehive/logger";
import type { PrismaClient } from "@ecehive/prisma";
import type { RestRegistrar, TrpcRegistrar } from "./api/types";
import type { EventBus } from "./events/bus";
import type { HumsEventMap } from "./events/registry";

// Forward declaration — PluginRegistry is defined in ./registry.ts.
// We import it as a type here to avoid circular reference issues at runtime.
import type { PluginRegistry } from "./registry";

// ---------------------------------------------------------------------------
// Re-export for convenience so consumers don't need to import from sub-paths
// ---------------------------------------------------------------------------
export type { RestRegistrar, TrpcRegistrar } from "./api/types";
export type { EventBus } from "./events/bus";
export type { HumsEventMap } from "./events/registry";

// ---------------------------------------------------------------------------
// Worker
// ---------------------------------------------------------------------------

/**
 * A background worker contributed by a plugin.
 *
 * Mirrors the interface used by existing cron jobs in `@ecehive/workers`.
 */
export interface WorkerDefinition {
	/** Human-readable name used for logging. */
	name: string;
	/** Start the worker (e.g. begin the cron schedule). */
	start(): void;
	/** Gracefully stop the worker. Optional — not all workers need clean teardown. */
	stop?(): void;
}

// ---------------------------------------------------------------------------
// Plugin server context
// ---------------------------------------------------------------------------

/**
 * The context object passed to `HumsPlugin.server.register()`.
 *
 * Provides access to every shared service a plugin might need:
 * the database, config, logger, event bus, API registrars, and the plugin
 * registry itself (for accessing sibling plugin public APIs).
 */
export interface PluginServerContext {
	/** Prisma client — authoritative database connection. */
	db: PrismaClient;

	/**
	 * Config service — read and write persisted configuration values.
	 *
	 * Typed as `typeof ConfigService` from `@ecehive/features` so that the
	 * same overloaded `get<K>()` signatures are available to plugins.
	 */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	config: {
		get<T = unknown>(key: string): Promise<T>;
		set(key: string, value: unknown): Promise<void>;
	};

	/**
	 * Named logger scoped to the plugin.
	 *
	 * The server creates this via `getLogger(plugin.name)` before calling
	 * `register()`.
	 */
	logger: Logger<ILogObj>;

	/** Typed event bus for inter-plugin communication. */
	events: EventBus<HumsEventMap>;

	/** Register tRPC sub-routers contributed by this plugin. */
	trpc: TrpcRegistrar;

	/** Register Fastify route handlers contributed by this plugin. */
	rest: RestRegistrar;

	/** Registry of all loaded plugins — allows accessing sibling plugin APIs. */
	plugins: PluginRegistry;
}

// ---------------------------------------------------------------------------
// Plugin manifest
// ---------------------------------------------------------------------------

// UI manifests are defined in src/ui/types.ts and re-exported from
// @ecehive/core/ui so that server-side code is not forced to bundle React.
// HumsPlugin uses `unknown` for client/kiosk to keep the server types
// tree-shakeable and avoid a hard React dependency on the server side.

/**
 * The top-level plugin interface every plugin must implement.
 */
export interface HumsPlugin {
	/** Unique plugin identifier. Must match the key in the plugin map. */
	name: string;

	/**
	 * Required plugin dependencies.
	 *
	 * If any listed plugin is absent from `ENABLED_PLUGINS`, startup will
	 * throw rather than silently starting without the dependency.
	 */
	dependencies?: string[];

	/**
	 * Optional plugin dependencies.
	 *
	 * If present and enabled, they are guaranteed to be loaded and
	 * registered before this plugin. If absent, this plugin loads
	 * normally without them.
	 */
	optionalDependencies?: string[];

	/** Server-side contribution (tRPC routes, REST routes, background workers). */
	server?: {
		/**
		 * Called during server startup after all dependencies have been
		 * registered. Plugins should register their tRPC sub-routers, REST
		 * handlers, and subscribe to events here.
		 */
		register: (ctx: PluginServerContext) => Promise<void>;

		/**
		 * Background workers contributed by this plugin.
		 *
		 * Workers are started after `register()` completes.
		 */
		workers?: WorkerDefinition[];
	};

	/**
	 * Admin UI manifest.
	 *
	 * Typed as `unknown` here; the concrete `PluginClientManifest` type is
	 * exported from `@ecehive/core/ui` for use in UI packages.
	 */
	client?: unknown;

	/**
	 * Kiosk UI manifest.
	 *
	 * Typed as `unknown` here; the concrete `KioskManifest` type is
	 * exported from `@ecehive/core/ui` for use in the kiosk app.
	 */
	kiosk?: unknown;
}
