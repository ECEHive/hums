import type { AnyRouter } from "@trpc/server";
import type { TrpcRegistrar } from "../api/types";

/**
 * Collects tRPC sub-routers contributed by plugins, then merges them with the
 * application's base router at server startup.
 *
 * Each plugin registers its sub-router under a unique namespace. Namespaces map
 * directly to top-level keys on the merged router — identical to how routes like
 * `sessions`, `auth`, etc. are declared in `packages/trpc/server/router.ts`.
 *
 * @example
 * ```ts
 * // Inside a plugin's server.register():
 * ctx.trpc.register("myPlugin", myPluginRouter);
 * ```
 */
export class TrpcRegistrarImpl implements TrpcRegistrar {
	private readonly routerMap = new Map<string, AnyRouter>();

	/**
	 * Register a plugin sub-router under the given namespace.
	 *
	 * @throws if the namespace is already taken by another plugin.
	 */
	register(namespace: string, subRouter: AnyRouter): void {
		if (this.routerMap.has(namespace)) {
			throw new Error(
				`tRPC namespace "${namespace}" is already registered. ` +
					"Each plugin must use a unique namespace.",
			);
		}
		this.routerMap.set(namespace, subRouter);
	}

	/**
	 * Merge all plugin sub-routers into the base application router.
	 *
	 * When no plugins have registered any routes, `baseRouter` is returned
	 * unchanged — no allocation overhead, full type preservation.
	 *
	 * When plugins have registered routes, a new router is created by spreading
	 * the base router's procedure record with the plugin entries. The
	 * `routerFactory` parameter must be the `router()` function exported from
	 * `@ecehive/trpc/server`; it is injected here to prevent a circular
	 * dependency between `@ecehive/core` and `@ecehive/trpc`.
	 *
	 * @param baseRouter    The app's compiled base tRPC router.
	 * @param routerFactory The `router()` function from `@ecehive/trpc/server`.
	 */
	merge<T extends AnyRouter>(
		baseRouter: T,
		// biome-ignore lint/suspicious/noExplicitAny: routerFactory has complex tRPC generic types
		routerFactory: (routes: Record<string, any>) => AnyRouter,
	): T | AnyRouter {
		if (this.routerMap.size === 0) {
			return baseRouter;
		}

		// Access the base router's compiled procedure record to spread it.
		// biome-ignore lint/suspicious/noExplicitAny: accessing tRPC router._def.record for merging
		const baseRecord = (baseRouter as any)._def.record as Record<
			string,
			unknown
		>;

		return routerFactory({
			...baseRecord,
			...Object.fromEntries(this.routerMap),
		});
	}

	/** Total number of plugin namespaces registered so far. */
	get size(): number {
		return this.routerMap.size;
	}
}
