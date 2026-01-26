import { BrandingService, type LogoType } from "@ecehive/features";
import type { FastifyPluginAsync } from "fastify";

/**
 * Branding asset endpoints
 *
 * Serves logos and favicons with appropriate caching headers.
 * These are public endpoints optimized for performance.
 *
 * Routes:
 * - GET /logo-light.svg - Light theme logo
 * - GET /logo-dark.svg - Dark theme logo
 * - GET /favicon.svg - Favicon
 */
export const brandingRoute: FastifyPluginAsync = async (fastify) => {
	// Helper to serve an SVG asset with caching
	const serveAsset = async (
		type: LogoType,
		reply: {
			header: (name: string, value: string) => typeof reply;
			status: (code: number) => typeof reply;
			send: (body: string) => void;
		},
		request: { headers: { "if-none-match"?: string } },
	) => {
		const asset = await BrandingService.get(type);

		// Check if client has cached version
		const clientEtag = request.headers["if-none-match"];
		if (clientEtag === asset.etag) {
			return reply.status(304).send("");
		}

		// Set caching headers
		// Short cache time (5 minutes) with revalidation for dynamic logos
		// This allows quick updates while still benefiting from caching
		reply.header("Content-Type", "image/svg+xml");
		reply.header("ETag", asset.etag);
		reply.header("Cache-Control", "public, max-age=300, must-revalidate");
		reply.header("Vary", "Accept-Encoding");

		return reply.send(asset.svg);
	};

	// Light theme logo
	fastify.get("/logo-light.svg", async (request, reply) => {
		return serveAsset("logo-light", reply, request);
	});

	// Dark theme logo
	fastify.get("/logo-dark.svg", async (request, reply) => {
		return serveAsset("logo-dark", reply, request);
	});

	// Favicon
	fastify.get("/favicon.svg", async (request, reply) => {
		return serveAsset("favicon", reply, request);
	});

	// Metadata endpoint (for debugging/admin)
	fastify.get("/info", async () => {
		const assets = await BrandingService.getAll();
		return {
			assets: Object.entries(assets).map(([type, data]) => ({
				type,
				isCustom: data.isCustom,
				etag: data.etag,
			})),
		};
	});
};
