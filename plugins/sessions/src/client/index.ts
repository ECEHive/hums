/**
 * Sessions plugin client manifest.
 *
 * This module is imported by the admin app to register sessions-related
 * pages and navigation items. The full implementation will be fleshed out
 * in Phase 11 when admin UI components are migrated to the plugin.
 *
 * For now this stub satisfies the `HumsPlugin.client` slot so that the
 * plugin can be imported from both server and client contexts without
 * errors.
 */

// The concrete PluginClientManifest type lives in @ecehive/core/ui.
// We avoid importing it here (server-side index.ts) to keep server builds
// free from React. The manifest is typed as `unknown` on the HumsPlugin
// interface; the admin app will cast it.
export const sessionsClientManifest = {
	pages: [],
} as const;
