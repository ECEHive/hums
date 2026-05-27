import { restApiRoute } from "@ecehive/rest";
import {
	appRouter,
	createContext,
	router as trpcRouterFactory,
} from "@ecehive/trpc/server";
import { fastifyTRPCPlugin } from "@trpc/server/adapters/fastify";
import type { FastifyPluginAsync } from "fastify";
import type { PluginBoot } from "../fastify";
import { brandingRoute } from "./branding";
import { configRoute } from "./config";
import { icalRoute } from "./ical";

/**
 * Factory that produces the `/api` Fastify plugin.
 *
 * Accepts the {@link PluginBoot} from the plugin system so that plugin-
 * contributed tRPC sub-routers and REST handlers are wired in alongside the
 * built-in application routes.
 */
export const createApiRoute =
	(boot: PluginBoot): FastifyPluginAsync =>
	async (fastify) => {
		fastify.get("/", async () => {
			// TODO: Add useful info here
			return {
				name: "API",
				status: "ok",
			};
		});

		fastify.register(configRoute, {
			prefix: "/config",
		});

		fastify.register(brandingRoute, {
			prefix: "/branding",
		});

		fastify.register(icalRoute, {
			prefix: "/ical",
		});

		fastify.get("/trpc", async () => {
			// TODO: Add useful info here
			return {
				name: "TRPC",
				status: "ok",
			};
		});

		// Merge any plugin-contributed tRPC sub-routers with the base app router.
		// When no plugins are loaded this returns appRouter unchanged (no overhead).
		const finalRouter = boot.trpcRegistrar.merge(appRouter, trpcRouterFactory);

		fastify.register(fastifyTRPCPlugin, {
			prefix: "/trpc",
			trpcOptions: {
				router: finalRouter,
				createContext,
				onError() {},
			},
		});

		fastify.register(restApiRoute, {
			prefix: "/rest",
		});

		// Mount any plugin-contributed REST handlers under /rest.
		// No-op when no plugins have registered REST routes.
		boot.restRegistrar.registerAll(fastify, "/rest");
	};
