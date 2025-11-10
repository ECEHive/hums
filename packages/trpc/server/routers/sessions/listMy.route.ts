import { prisma } from "@ecehive/prisma";
import z from "zod";
import type { TProtectedProcedureContext } from "../../trpc";

export const ZListMySchema = z.object({
	limit: z.number().min(1).max(100).optional(),
	offset: z.number().min(0).optional(),
});

export type TListMySchema = z.infer<typeof ZListMySchema>;

export type TListMyOptions = {
	ctx: TProtectedProcedureContext;
	input: TListMySchema;
};

export async function listMyHandler(options: TListMyOptions) {
	const userId = options.ctx.user.id;
	const { limit = 50, offset = 0 } = options.input;

	const [sessions, total] = await Promise.all([
		prisma.session.findMany({
			where: { userId },
			orderBy: { startedAt: "desc" },
			skip: offset,
			take: limit,
			select: {
				id: true,
				startedAt: true,
				endedAt: true,
			},
		}),
		prisma.session.count({ where: { userId } }),
	]);

	return {
		sessions,
		total,
	};
}
