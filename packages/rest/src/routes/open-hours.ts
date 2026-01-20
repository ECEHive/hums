import { getOpenHours } from "@ecehive/features";
import type { FastifyPluginAsync } from "fastify";
import { successResponse } from "../shared/responses";

// ===== Routes =====

/**
 * Open Hours routes - public endpoints that do not require authentication.
 * These endpoints provide information about facility open hours.
 */
export const openHoursRoutes: FastifyPluginAsync = async (fastify) => {
	/**
	 * GET /
	 * Get open hours for all visible periods
	 *
	 * This is a public endpoint - no authentication required.
	 * Returns aggregated open hours derived from shift schedules.
	 */
	fastify.get("/", async (_request, reply) => {
		const data = await getOpenHours();
		return reply.send(successResponse(data));
	});
};
