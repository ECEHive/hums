/**
 * @ecehive/core — HUMS plugin framework
 *
 * This is the main server-side entry point. It exports:
 * - The `EventBus` class and core event map
 * - The `PluginRegistry` class
 * - All server-side plugin type definitions
 * - Concrete server implementations: `TrpcRegistrarImpl`, `RestRegistrarImpl`,
 *   `WorkerScheduler`
 *
 * UI types (kiosk/admin manifests) are exported from `@ecehive/core/ui`
 * to avoid bundling React into server builds.
 */

// API registrar types
export type { RestRegistrar, TrpcRegistrar } from "./api/types";
// Events
export { EventBus } from "./events/bus";
export type { HumsEventMap } from "./events/registry";
// Registry
export { PluginRegistry } from "./registry";
// Server implementations
export { RestRegistrarImpl } from "./server/rest-registrar";
export { TrpcRegistrarImpl } from "./server/trpc-registrar";
export { WorkerScheduler } from "./server/worker-scheduler";
// Plugin types
export type {
	HumsPlugin,
	PluginServerContext,
	WorkerDefinition,
} from "./types";
