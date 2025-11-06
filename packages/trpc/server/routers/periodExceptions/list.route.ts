import { type Prisma, prisma } from "@ecehive/prisma";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZListSchema = z.object({
	limit: z.number().min(1).max(100).optional(),
	offset: z.number().min(0).optional(),
	periodId: z.number().min(1),
	search: z.string().min(1).max(100).optional(),
});

export type TListSchema = z.infer<typeof ZListSchema>;

export type TListOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TListSchema;
};

export async function listHandler(options: TListOptions) {
	const { limit = 10, offset = 0, periodId, search } = options.input;

	const where: Prisma.PeriodExceptionWhereInput = {
		periodId,
	};

	if (search) {
		where.name = { contains: search, mode: "insensitive" };
	}

	const [result, total] = await Promise.all([
		prisma.periodException.findMany({
			where,
			orderBy: { start: "asc" },
			skip: offset,
			take: limit,
		}),
		prisma.periodException.count({ where }),
	]);

	return { periodExceptions: result, total };
}
