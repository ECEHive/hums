import { type Prisma, prisma } from "@ecehive/prisma";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZListSchema = z.object({
	limit: z.number().min(1).max(100).optional(),
	offset: z.number().min(0).optional(),
	filterUserId: z.number().min(1).optional(),
});

export type TListSchema = z.infer<typeof ZListSchema>;

export type TListOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TListSchema;
};

export async function listHandler(options: TListOptions) {
	const { filterUserId, limit = 50, offset = 0 } = options.input;

	const where: Prisma.SessionWhereInput = filterUserId
		? { userId: filterUserId }
		: {};

	const [sessions, total] = await Promise.all([
		prisma.session.findMany({
			where,
			orderBy: { startedAt: "desc" },
			skip: offset,
			take: limit,
		}),
		prisma.session.count({ where }),
	]);

	return {
		sessions,
		total,
	};
}
