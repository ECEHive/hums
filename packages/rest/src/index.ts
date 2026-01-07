import type { FastifyPluginAsync } from "fastify";
import { registerAuthGuard } from "./auth";
import { rolesRoutes } from "./routes/roles";
import { slackRoutes } from "./routes/slack";
import { usersRoutes } from "./routes/users";

export const restApiRoute: FastifyPluginAsync = async (fastify) => {
	// Custom parser for Slack requests
	// The apiTokenGuard hook consumes the stream for signature validation and populates body
	// No need for Fastify to parse it again
	fastify.addContentTypeParser(
		"application/x-www-form-urlencoded",
		(req, _payload, done) => {
			done(null, req.body || {});
		},
	);

	registerAuthGuard(fastify);

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

	fastify.register(slackRoutes, {
		prefix: "/slack",
	});
};
