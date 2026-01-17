import type { FastifyPluginAsync } from "fastify";

/**
 * Client configuration endpoint.
 *
 * This endpoint provides runtime configuration values to the client applications.
 * Since the client apps are pre-built and served as static files, they cannot use
 * build-time environment variables (VITE_*). Instead, they fetch these values at
 * runtime from this endpoint.
 *
 * All values exposed here must be safe for public consumption.
 */
export const configRoute: FastifyPluginAsync = async (fastify) => {
	fastify.get("/", async () => {
		return {
			// Authentication configuration
			authProvider: process.env.AUTH_PROVIDER ?? "CAS_PROXIED",
			casLoginUrl: process.env.AUTH_CAS_LOGIN_URL ?? null,
			casProxyUrl: process.env.AUTH_CAS_PROXY_URL ?? null,

			// Observability
			clientSentryDsn: process.env.CLIENT_SENTRY_DSN ?? null,
			kioskSentryDsn: process.env.KIOSK_SENTRY_DSN ?? null,
			overviewSentryDsn: process.env.OVERVIEW_SENTRY_DSN ?? null,

			// Timezone
			timezone: process.env.TZ ?? "America/New_York",

			// Client base URL (for kiosk one-time login redirects)
			clientBaseUrl: process.env.CLIENT_BASE_URL ?? null,
		};
	});
};
