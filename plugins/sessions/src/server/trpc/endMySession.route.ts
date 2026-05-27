import type { EventBus, HumsEventMap } from "@ecehive/core";
import {
	endSession,
	getCurrentSession,
	validateCanEndSession,
} from "@ecehive/features";
import { prisma } from "@ecehive/prisma";
import type { TProtectedProcedureContext } from "@ecehive/trpc/server";
import { TRPCError } from "@trpc/server";
import z from "zod";

export const ZEndMySessionSchema = z.object({});

export type TEndMySessionSchema = z.infer<typeof ZEndMySessionSchema>;

export type TEndMySessionOptions = {
	ctx: TProtectedProcedureContext;
	input: TEndMySessionSchema;
	events?: EventBus<HumsEventMap>;
};

/**
 * End the user's current session (only works for general sessions).
 * Staffing sessions must be ended via physical card scan at kiosk.
 */
export async function endMySessionHandler(options: TEndMySessionOptions) {
	const userId = options.ctx.user.id;

	const result = await prisma.$transaction(
		async (tx) => {
			const now = new Date();

			// Get user's current session status
			const currentSession = await getCurrentSession(tx, userId);

			// Cannot end session if not in one
			if (!currentSession) {
				throw new TRPCError({
					code: "CONFLICT",
					message: "You are not currently in a session",
				});
			}

			// Cannot end staffing sessions via this method
			if (currentSession.sessionType === "staffing") {
				throw new TRPCError({
					code: "FORBIDDEN",
					message:
						"Staffing sessions cannot be ended using this method. Please use a kiosk to scan your card.",
				});
			}

			// Check if user has any active control points that need to be turned off first
			await validateCanEndSession(tx, userId);

			// End the current session using shared utility
			const session = await endSession(tx, currentSession.id, now);

			return { session, now };
		},
		{ maxWait: 5000, timeout: 10000 },
	);

	// Emit event after the transaction commits
	options.events?.emit("session:ended", {
		sessionId: result.session.id,
		userId,
		sessionType: result.session.sessionType,
		startedAt: result.session.startedAt,
		endedAt: result.now,
	});

	return { session: result.session };
}
