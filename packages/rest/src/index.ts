import type { FastifyPluginAsync } from "fastify";
import { registerApiTokenGuard } from "./auth";
import { rolesRoutes } from "./routes/roles";
import { usersRoutes } from "./routes/users";

export const restApiRoute: FastifyPluginAsync = async (fastify) => {
	registerApiTokenGuard(fastify);

	// Root endpoint - API info
	fastify.get("/", async () => ({
		name: "REST API",
		status: "ok",
	}));

	// Register route modules
	fastify.register(usersRoutes, {
		prefix: "/users",
	});

	fastify.register(rolesRoutes, {
		prefix: "/roles",
	});
};
