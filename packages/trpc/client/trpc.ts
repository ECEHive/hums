/// <reference types="vite/client" />

import {
	createTRPCClient,
	httpBatchLink,
	httpSubscriptionLink,
	splitLink,
} from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "../server/router";

const getHeaders = () => {
	if (typeof window === "undefined") return {};
	const token = localStorage.getItem("auth_token");
	return token ? { Authorization: `Bearer ${token}` } : {};
};

const getSubscriptionUrl = () => {
	const baseUrl = `/api/trpc`;
	const token = localStorage.getItem("auth_token");
	if (token) {
		return `${baseUrl}?token=${encodeURIComponent(token)}`;
	}
	return baseUrl;
};

export const trpc = createTRPCClient<AppRouter>({
	links: [
		splitLink({
			condition: (op) => op.type === "subscription",
			// Use SSE for subscriptions
			true: httpSubscriptionLink({
				url: getSubscriptionUrl,
				transformer: superjson,
			}),
			// Use batch HTTP link for queries and mutations
			false: httpBatchLink({
				url: `/api/trpc`,
				transformer: superjson,
				headers: getHeaders,
			}),
		}),
	],
});
