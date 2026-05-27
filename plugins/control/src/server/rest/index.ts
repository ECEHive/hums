import { registerAuthGuard } from "@ecehive/rest";
import type { FastifyPluginAsync } from "fastify";
import { controlGatewayRoutes } from "./control-gateways";
import { controlPointsRoutes } from "./control-points";

/**
 * Registers control plugin REST endpoints under /api/rest.
 *
 * Public:
 * - /control/gateways/invoke
 *
 * Protected via API token/Slack auth:
 * - /control/points
 */
export const controlRestRoutes: FastifyPluginAsync = async (fastify) => {
	fastify.register(controlGatewayRoutes, {
		prefix: "/control/gateways",
	});

	fastify.register(async (protectedRoutes) => {
		registerAuthGuard(protectedRoutes);

		protectedRoutes.register(controlPointsRoutes, {
			prefix: "/control/points",
		});
	});
};
