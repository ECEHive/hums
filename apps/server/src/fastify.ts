import cors from "@fastify/cors";
import fastify from "fastify";
import { apiRoute } from "./routes/api";

/**
 * Creates and configures the Fastify server instance
 */
async function createServer() {
	const server = fastify({
		routerOptions: {
			maxParamLength: 5000,
		},
	});

	// CORS configuration
	// In production, CORS_ORIGINS must be explicitly set
	const allowedOrigins = process.env.CORS_ORIGINS
		? process.env.CORS_ORIGINS.split(",").map((origin) => origin.trim())
		: null;

	if (!allowedOrigins && process.env.NODE_ENV === "production") {
		throw new Error(
			"CORS_ORIGINS environment variable must be set in production. " +
				"Set it to a comma-separated list of allowed origins (e.g., https://app.example.com)",
		);
	}

	await server.register(cors, {
		// In development without CORS_ORIGINS, allow all origins (for local dev convenience)
		// In production, CORS_ORIGINS is required
		origin: allowedOrigins ?? true,
		credentials: true, // Allow cookies/auth headers
	});

	server.get("/", async () => {
		// TODO: Add useful info here
		return {
			name: "Server",
			status: "ok",
		};
	});

	await server.register(apiRoute, {
		prefix: "/api",
	});

	return server;
}

export { createServer };
