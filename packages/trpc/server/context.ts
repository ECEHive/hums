import { validateToken } from "@ecehive/auth";
import type { CreateFastifyContextOptions } from "@trpc/server/adapters/fastify";

export async function createContext({ req, res }: CreateFastifyContextOptions) {
	// For SSE subscriptions, the token might be in the query string since EventSource doesn't support custom headers
	let token = req.headers.authorization?.split(" ")[1];

	// Debug logging
	console.log("[Context] Request URL:", req.url);
	console.log("[Context] Headers:", req.headers);
	console.log("[Context] Query:", req.query);
	console.log("[Context] Token from header:", token);

	// Check query params for token (used by SSE subscriptions)
	if (
		!token &&
		req.query &&
		typeof req.query === "object" &&
		"token" in req.query
	) {
		token = req.query.token as string;
		console.log("[Context] Token from query:", token);
	}

	const userId = token ? await validateToken(token) : null;
	console.log("[Context] User ID:", userId);

	return { req, res, userId, token };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
