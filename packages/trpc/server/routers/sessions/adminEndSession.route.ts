import { endSession } from "@ecehive/features";
import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZAdminEndSessionSchema = z.object({
	sessionId: z.number().min(1),
});

export type TAdminEndSessionSchema = z.infer<typeof ZAdminEndSessionSchema>;

export type TAdminEndSessionOptions = {
	ctx: TPermissionProtectedProcedureContext;
	input: TAdminEndSessionSchema;
};

/**
 * Admin route to end a specific session by ID
 * Requires sessions.manage permission
 */
export async function adminEndSessionHandler(options: TAdminEndSessionOptions) {
	const { sessionId } = options.input;

	return await prisma.$transaction(
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

			// End the session using shared utility
			const updatedSession = await endSession(tx, sessionId, now);

			return {
				session: updatedSession,
				user: existingSession.user,
			};
		},
		{
			maxWait: 5000,
			timeout: 10000,
		},
	);
}
