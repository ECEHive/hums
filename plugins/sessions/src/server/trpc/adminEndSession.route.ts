import type { EventBus, HumsEventMap } from "@ecehive/core";
import { endSession, validateCanEndSession } from "@ecehive/features";
import { prisma } from "@ecehive/prisma";
import type { TPermissionProtectedProcedureContext } from "@ecehive/trpc/server";
import { TRPCError } from "@trpc/server";
import z from "zod";

export const ZAdminEndSessionSchema = z.object({
	sessionId: z.number().min(1),
});

export type TAdminEndSessionSchema = z.infer<typeof ZAdminEndSessionSchema>;

export type TAdminEndSessionOptions = {
	ctx: TPermissionProtectedProcedureContext;
	input: TAdminEndSessionSchema;
	events?: EventBus<HumsEventMap>;
};

/**
 * Admin route to end a specific session by ID.
 * Requires sessions.manage permission.
 */
export async function adminEndSessionHandler(options: TAdminEndSessionOptions) {
	const { sessionId } = options.input;

	const result = await prisma.$transaction(
		async (tx) => {
			const now = new Date();

			// Get the session
			const existingSession = await tx.session.findUnique({
				where: { id: sessionId },
				include: {
					user: {
						select: {
							id: true,
							name: true,
							username: true,
							email: true,
						},
					},
				},
			});

			if (!existingSession) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Session not found",
				});
			}

			if (existingSession.endedAt !== null) {
				throw new TRPCError({
					code: "CONFLICT",
					message: "Session has already ended",
				});
			}

			// Check if user has any active control points that need to be turned off first
			await validateCanEndSession(tx, existingSession.user.id);

			// End the session using shared utility
			const updatedSession = await endSession(tx, sessionId, now);

			return { session: updatedSession, user: existingSession.user, now };
		},
		{ maxWait: 5000, timeout: 10000 },
	);

	// Emit event after the transaction commits
	options.events?.emit("session:ended", {
		sessionId: result.session.id,
		userId: result.user.id,
		sessionType: result.session.sessionType,
		startedAt: result.session.startedAt,
		endedAt: result.now,
	});

	return {
		session: result.session,
		user: result.user,
	};
}
