import { findUserByCard } from "@ecehive/features";
import { prisma } from "@ecehive/prisma";
import z from "zod";
import type { TKioskProtectedProcedureContext } from "../../trpc";

export const ZTapInOutSchema = z.object({
	cardNumber: z.string().regex(/^\d+$/),
});

export type TTapInOutSchema = z.infer<typeof ZTapInOutSchema>;

export type TTapInOutOptions = {
	ctx: TKioskProtectedProcedureContext;
	input: TTapInOutSchema;
};

export async function tapInOutHandler(options: TTapInOutOptions) {
	const { cardNumber } = options.input;

	const user = await findUserByCard(cardNumber);

	return await prisma.$transaction(async (tx) => {
		// Get the most recent session for the user
		const mostRecentSession = await tx.session.findFirst({
			where: { userId: user.id },
			orderBy: { startedAt: "desc" },
		});

		// If there is no session, or the most recent session has an endedAt, create a new session (tap in)
		if (!mostRecentSession || mostRecentSession.endedAt) {
			const session = await tx.session.create({
				data: {
					userId: user.id,
					startedAt: new Date(),
				},
			});

			return {
				status: "tapped_in",
				user,
				session,
			};
		} else {
			// Otherwise, update the most recent session to set endedAt (tap out)
			const session = await tx.session.update({
				where: { id: mostRecentSession.id },
				data: { endedAt: new Date() },
			});
			return {
				status: "tapped_out",
				user,
				session,
			};
		}
	});
}
