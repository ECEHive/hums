import { type BrandingData, BrandingService } from "@ecehive/features";
import type { FastifyPluginAsync } from "fastify";

/**
 * Branding endpoint - serves public branding data
 *
 * This endpoint provides theme colors, logos, and favicon to client applications.
 * It's a public endpoint (no authentication required) since branding is needed
 * before user authentication.
 *
 * Responses are cached at the HTTP level for efficiency.
 */
export const brandingRoute: FastifyPluginAsync = async (fastify) => {
	/**
	 * GET /api/branding
	 * Returns all branding data (colors, logos)
	 */
	fastify.get<{
		Reply: BrandingData;
	}>("/", async (_request, reply) => {
		const branding = await BrandingService.getBranding();

		// Set cache headers - branding doesn't change often
		reply.header("Cache-Control", "public, max-age=300"); // 5 minutes
		reply.header("Vary", "Accept-Encoding");

		return branding;
	});

	/**
	 * GET /api/branding/logo/:mode
	 * Returns logo SVG for the specified mode (light/dark)
	 */
	fastify.get<{
		Params: { mode: string };
	}>("/logo/:mode", async (request, reply) => {
		const { mode } = request.params;

		if (mode !== "light" && mode !== "dark") {
			reply.status(400);
			return { error: "Invalid mode. Use 'light' or 'dark'" };
		}

		const logo = await BrandingService.getLogo(mode);

		reply.header("Content-Type", "image/svg+xml");
		reply.header("Cache-Control", "public, max-age=3600"); // 1 hour
		reply.header("Vary", "Accept-Encoding");

		return reply.send(logo);
	});

	/**
	 * GET /api/branding/favicon.svg
	 * Returns the favicon as SVG
	 */
	fastify.get("/favicon.svg", async (_request, reply) => {
		const favicon = await BrandingService.getFavicon();

		reply.header("Content-Type", "image/svg+xml");
		reply.header("Cache-Control", "public, max-age=86400"); // 24 hours
		reply.header("Vary", "Accept-Encoding");

		return reply.send(favicon);
	});

	/**
	 * GET /api/branding/colors/:mode
	 * Returns color values for the specified mode
	 */
	fastify.get<{
		Params: { mode: string };
	}>("/colors/:mode", async (request, reply) => {
		const { mode } = request.params;

		if (mode !== "light" && mode !== "dark") {
			reply.status(400);
			return { error: "Invalid mode. Use 'light' or 'dark'" };
		}

		const colors = await BrandingService.getColors(mode);

		reply.header("Cache-Control", "public, max-age=300"); // 5 minutes
		reply.header("Vary", "Accept-Encoding");

		return colors;
	});
};
