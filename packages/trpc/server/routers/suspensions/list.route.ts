import { listSuspensions } from "@ecehive/features";
import { prisma } from "@ecehive/prisma";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZListSchema = z.object({
	search: z.string().optional(),
	userId: z.number().optional(),
	active: z.boolean().optional(),
	offset: z.number().default(0),
	limit: z.number().default(50),
});

export type TListSchema = z.infer<typeof ZListSchema>;

export type TListOptions = {
	ctx: TPermissionProtectedProcedureContext;
	input: TListSchema;
};

export async function listHandler(options: TListOptions) {
	const { search, userId, active, offset, limit } = options.input;

	const result = await listSuspensions(prisma, {
		search,
		userId,
		active,
		offset,
		limit,
	});

	return result;
}
