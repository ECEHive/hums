import cors from "@fastify/cors";
import fastifyWebsocket from "@fastify/websocket";
import fastify from "fastify";
import { apiRoute } from "./routes/api";

const server = fastify({
	routerOptions: {
		maxParamLength: 5000,
	},
});

const allowedOrigins = process.env.CORS_ORIGINS
	? process.env.CORS_ORIGINS.split(",")
	: "*";

server.register(cors, {
	origin: allowedOrigins,
	credentials: true, // Allow cookies/auth headers
});

server.register(fastifyWebsocket);

server.get("/", async () => {
	// TODO: Add useful info here
	return {
		name: "Server",
		status: "ok",
	};
});

server.register(apiRoute, {
	prefix: "/api",
});

export { server };
