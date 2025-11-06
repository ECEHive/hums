import { appRouter, createContext } from "@ecehive/trpc/server";
import { fastifyTRPCPlugin } from "@trpc/server/adapters/fastify";
import type { FastifyPluginAsync } from "fastify";

export const apiRoute: FastifyPluginAsync = async (fastify) => {
	fastify.get("/", async () => {
		// TODO: Add useful info here
		return {
			name: "API",
			status: "ok",
		};
	});

	fastify.get("/trpc", async () => {
		// TODO: Add useful info here
		return {
			name: "TRPC",
			status: "ok",
		};
	});

	fastify.register(fastifyTRPCPlugin, {
		prefix: "/trpc",
		trpcOptions: {
			router: appRouter,
			createContext,
			onError(opts: { path?: string; error: Error }) {
				console.error(
					`Error in tRPC handler on path '${opts.path}':`,
					opts.error,
				);
			},
		},
	});
};
