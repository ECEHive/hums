import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import type { RestRegistrar } from "../api/types";

/**
 * Collects Fastify plugin handlers contributed by plugins, then registers
 * them all onto the Fastify instance at server startup.
 *
 * Plugins receive their routes mounted under a shared prefix (typically
 * `/api/rest`) so they sit alongside the application's built-in REST routes.
 *
 * @example
 * ```ts
 * // Inside a plugin's server.register():
 * ctx.rest.register(async (fastify) => {
 *   fastify.get("/my-route", handler);
 * });
 * ```
 */
export class RestRegistrarImpl implements RestRegistrar {
	private readonly handlers: FastifyPluginAsync[] = [];

	/**
	 * Collect a Fastify plugin for later registration.
	 *
	 * The plugin is not mounted immediately; call {@link registerAll} once the
	 * Fastify instance is ready.
	 */
	register(plugin: FastifyPluginAsync): void {
		this.handlers.push(plugin);
	}

	/**
	 * Mount all collected plugins onto the given Fastify instance.
	 *
	 * When `prefix` is provided each plugin is registered with that prefix;
	 * otherwise plugins are registered without a prefix (inheriting the parent
	 * route context).
	 *
	 * This is a no-op when no plugins have registered any handlers.
	 *
	 * @param fastify  The Fastify server instance.
	 * @param prefix   Optional URL prefix applied to every plugin (e.g. `/rest`).
	 */
	registerAll(fastify: FastifyInstance, prefix?: string): void {
		for (const handler of this.handlers) {
			if (prefix) {
				fastify.register(handler, { prefix });
			} else {
				fastify.register(handler);
			}
		}
	}

	/** `true` when no plugin has registered any REST handlers. */
	get isEmpty(): boolean {
		return this.handlers.length === 0;
	}

	/** Total number of REST handlers registered so far. */
	get size(): number {
		return this.handlers.length;
	}
}
