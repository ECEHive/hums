import type { AnyRouter } from "@trpc/server";
import type { FastifyPluginAsync } from "fastify";

/**
 * Collects tRPC sub-routers contributed by plugins.
 *
 * In Phase 2, the concrete implementation merges all registered sub-routers
 * into the main {@link AppRouter} via `mergeRouters()`.
 */
export interface TrpcRegistrar {
	/**
	 * Register a tRPC sub-router under the given namespace.
	 *
	 * The namespace becomes the top-level key in the merged AppRouter.
	 * Attempting to register the same namespace twice throws.
	 *
	 * @example
	 * ctx.trpc.register("sessions", sessionsRouter);
	 */
	register(namespace: string, router: AnyRouter): void;
}

/**
 * Collects Fastify plugin handlers contributed by plugins.
 *
 * In Phase 2, the concrete implementation calls `fastify.register()` for
 * each handler during server startup.
 */
export interface RestRegistrar {
	/**
	 * Register a Fastify plugin that contributes REST routes.
	 *
	 * The plugin receives the same Fastify instance (scoped to `/api/rest`)
	 * that core REST routes use.
	 *
	 * @example
	 * ctx.rest.register(myPluginRoutes);
	 */
	register(plugin: FastifyPluginAsync): void;
}
