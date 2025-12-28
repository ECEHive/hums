import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import z from "zod";
import type { TProtectedProcedureContext } from "../../trpc";

export const ZEndMySessionSchema = z.object({});

export type TEndMySessionSchema = z.infer<typeof ZEndMySessionSchema>;

export type TEndMySessionOptions = {
	ctx: TProtectedProcedureContext;
	input: TEndMySessionSchema;
};

/**
 * End the user's current session (only works for general sessions)
 * Staffing sessions must be ended via physical card scan at kiosk
 */
export async function endMySessionHandler(options: TEndMySessionOptions) {
	const userId = options.ctx.user.id;

	return await prisma.$transaction(
		async (tx) => {
			const now = new Date();

			// Get user's current session status
			const currentSession = await tx.session.findFirst({
				where: {
					userId,
					endedAt: null,
				},
				orderBy: { startedAt: "desc" },
			});

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

			// End the current session
			const session = await tx.session.update({
				where: { id: currentSession.id },
				data: { endedAt: now },
			});

			return {
				session,
			};
		},
		{
			maxWait: 5000,
			timeout: 10000,
		},
	);
}
