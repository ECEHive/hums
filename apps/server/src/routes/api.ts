import { restApiRoute } from "@ecehive/rest";
import { appRouter, createContext } from "@ecehive/trpc/server";
import { fastifyTRPCPlugin } from "@trpc/server/adapters/fastify";
import type { FastifyPluginAsync } from "fastify";
import { configRoute } from "./config";

export const apiRoute: FastifyPluginAsync = async (fastify) => {
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
			onError() {},
		},
	});

	fastify.register(restApiRoute, {
		prefix: "/rest",
	});
};
