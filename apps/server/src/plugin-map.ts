import type { HumsPlugin } from "@ecehive/core";

/**
 * Lazy plugin import map.
 *
 * Each entry maps a plugin's canonical name to a zero-argument async factory
 * that dynamically imports the plugin module. Dynamic imports are used so that
 * plugin code is only loaded when the plugin is actually enabled — keeping the
 * server startup fast even as the plugin catalogue grows.
 *
 * When `ENABLED_PLUGINS` is set in the environment only the listed keys are
 * loaded. When absent, all keys defined here are loaded automatically.
 *
 * Add entries here as plugins are implemented under `/plugins/`:
 *
 * @example
 * ```ts
 * export const pluginMap: Record<string, () => Promise<HumsPlugin>> = {
 *   sessions: () => import("@ecehive/plugin-sessions").then((m) => m.default),
 * };
 * ```
 */
export const pluginMap: Record<string, () => Promise<HumsPlugin>> = {
	sessions: () => import("@ecehive/plugin-sessions").then((m) => m.default),
	control: () => import("@ecehive/plugin-control").then((m) => m.default),
};
