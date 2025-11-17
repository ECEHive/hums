import type { FastifyPluginAsync } from "fastify";
import { registerApiTokenGuard } from "./auth";
import { usersRoutes } from "./routes/users";

export const restApiRoute: FastifyPluginAsync = async (fastify) => {
	registerApiTokenGuard(fastify);

	fastify.get("/", async () => ({
		name: "REST",
		status: "ok",
	}));

	fastify.register(usersRoutes, {
		prefix: "/users",
	});
};
