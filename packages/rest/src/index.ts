import type { FastifyPluginAsync } from "fastify";
import { registerAuthGuard } from "./auth";
import { controlPointsRoutes } from "./routes/control-points";
import { openHoursRoutes } from "./routes/open-hours";
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

	// Root endpoint - API info
	fastify.get("/", async () => ({
		name: "REST API",
		status: "ok",
	}));

	// ===== Public Routes (no authentication required) =====
	// These routes are registered before the auth guard is applied
	fastify.register(openHoursRoutes, {
		prefix: "/open-hours",
	});

	// ===== Protected Routes (authentication required) =====
	// Create a sub-context with auth guard for protected routes
	fastify.register(async (protectedRoutes) => {
		registerAuthGuard(protectedRoutes);

		// Register route modules
		protectedRoutes.register(usersRoutes, {
			prefix: "/users",
		});

		protectedRoutes.register(rolesRoutes, {
			prefix: "/roles",
		});

		protectedRoutes.register(slackRoutes, {
			prefix: "/slack",
		});

		protectedRoutes.register(controlPointsRoutes, {
			prefix: "/control/points",
		});
	});
};
