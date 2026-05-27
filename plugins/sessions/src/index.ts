// Import the event declarations so they are registered at module load time.
// This must be a side-effect import (no exports used from it).
import "./events";

import type { HumsPlugin } from "@ecehive/core";
import { sessionsClientManifest } from "./client/index";
import { buildSessionsRouter } from "./server/trpc/_route";
import { endOldSessionsWorker } from "./server/workers/end-old-sessions";

/**
 * Sessions plugin for HUMS.
 *
 * Contributes:
 * - tRPC `sessions` sub-router (tap-in/tap-out, list, stats, admin management)
 * - `endOldSessions` background worker (auto-terminates timed-out sessions)
 * - Session domain events (`session:started`, `session:ended`, `session:type-switched`)
 */
const sessionsPlugin: HumsPlugin = {
	name: "sessions",

	server: {
		async register(ctx) {
			// Build the router with event-bus access so route handlers can emit
			// domain events after successful database transactions.
			const sessionsRouter = buildSessionsRouter(ctx.events);
			ctx.trpc.register("sessions", sessionsRouter);

			ctx.logger.info("Sessions plugin registered");
		},

		workers: [endOldSessionsWorker],
	},

	client: sessionsClientManifest,
};

export default sessionsPlugin;
