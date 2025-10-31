import { db, sessions } from "@ecehive/drizzle";
import { findUserByCard } from "@ecehive/features";
import { desc, eq } from "drizzle-orm";
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

	// Get the most recent session for the user
	const [mostRecentSession] = await db
		.select()
		.from(sessions)
		.where(eq(sessions.userId, user.id))
		.orderBy(desc(sessions.startedAt))
		.limit(1);

	// If there is no session, or the most recent session has an endedAt, create a new session (tap in)
	if (!mostRecentSession || mostRecentSession.endedAt) {
		const session = await db
			.insert(sessions)
			.values({
				userId: user.id,
				startedAt: new Date(),
			})
			.returning();

		return {
			status: "tapped_in",
			user,
			session: session[0],
		};
	} else {
		// Otherwise, update the most recent session to set endedAt (tap out)
		const session = await db
			.update(sessions)
			.set({ endedAt: new Date() })
			.where(eq(sessions.id, mostRecentSession.id))
			.returning();
		return {
			status: "tapped_out",
			user,
			session: session[0],
		};
	}
}
