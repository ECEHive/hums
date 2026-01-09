import { getUserSuspensions } from "@ecehive/features";
import { prisma } from "@ecehive/prisma";
import z from "zod";
import type { TProtectedProcedureContext } from "../../trpc";

export const ZListMySchema = z.object({}).optional();

export type TListMySchema = z.infer<typeof ZListMySchema>;

export type TListMyOptions = {
	ctx: TProtectedProcedureContext;
	input: TListMySchema;
};

/**
 * List suspensions for the current user
 * Note: Only returns external notes (shared notes), not internal notes
 */
export async function listMyHandler(options: TListMyOptions) {
	const userId = options.ctx.user.id;

	const suspensions = await getUserSuspensions(prisma, userId);

	// Filter out internal notes - users should only see external notes
	return suspensions.map((suspension) => ({
		id: suspension.id,
		startDate: suspension.startDate,
		endDate: suspension.endDate,
		externalNotes: suspension.externalNotes,
		createdAt: suspension.createdAt,
	}));
}
