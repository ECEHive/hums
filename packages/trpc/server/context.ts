import { validateToken } from "@ecehive/auth";
import type { CreateFastifyContextOptions } from "@trpc/server/adapters/fastify";

export async function createContext({ req, res }: CreateFastifyContextOptions) {
	// For SSE subscriptions, the token might be in the query string since EventSource doesn't support custom headers
	let token = req.headers.authorization?.split(" ")[1];

	// Check query params for token (used by SSE subscriptions)
	if (
		!token &&
		req.query &&
		typeof req.query === "object" &&
		"token" in req.query
	) {
		token = req.query.token as string;
	}

	const userId = token ? await validateToken(token) : null;

	return { req, res, userId, token };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
