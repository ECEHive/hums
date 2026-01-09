import { getActiveSuspension } from "@ecehive/features";
import { prisma } from "@ecehive/prisma";
import z from "zod";
import type { TProtectedProcedureContext } from "../../trpc";

export const ZGetMyActiveSchema = z.object({}).optional();

export type TGetMyActiveSchema = z.infer<typeof ZGetMyActiveSchema>;

export type TGetMyActiveOptions = {
	ctx: TProtectedProcedureContext;
	input: TGetMyActiveSchema;
};

/**
 * Get the current user's active suspension (if any)
 * Returns null if not suspended
 */
export async function getMyActiveHandler(options: TGetMyActiveOptions) {
	const userId = options.ctx.user.id;

	const suspension = await getActiveSuspension(prisma, userId);

	if (!suspension) {
		return null;
	}

	// Only return fields safe to share with user
	return {
		id: suspension.id,
		startDate: suspension.startDate,
		endDate: suspension.endDate,
		externalNotes: suspension.externalNotes,
	};
}
