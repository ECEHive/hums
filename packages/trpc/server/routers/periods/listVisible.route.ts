import { type Prisma, prisma } from "@ecehive/prisma";
import z from "zod";
import type { TProtectedProcedureContext } from "../../trpc";

export const ZListVisibleSchema = z.object({
	limit: z.number().min(1).max(100).optional(),
	offset: z.number().min(0).optional(),
});

export type TListVisibleSchema = z.infer<typeof ZListVisibleSchema>;

export type TListVisibleOptions = {
	ctx: TProtectedProcedureContext;
	input: TListVisibleSchema;
};

/**
 * List periods that are currently visible based on their visibility window.
 * This endpoint is accessible to any authenticated user (no specific permission required).
 * Only returns periods where the current time is within the visibility window.
 */
export async function listVisibleHandler(options: TListVisibleOptions) {
	const { limit = 10, offset = 0 } = options.input;
	const now = new Date();

	const filters: Prisma.PeriodWhereInput[] = [
		{ visibleStart: { lte: now } },
		{ visibleEnd: { gte: now } },
	];

	if (!options.ctx.user.isSystemUser) {
		filters.push({
			OR: [
				{ roles: { none: {} } },
				{
					roles: {
						some: {
							users: {
								some: { id: options.ctx.user.id },
							},
						},
					},
				},
			],
		});
	}

	const where: Prisma.PeriodWhereInput = {
		AND: filters,
	};

	const [periods, total] = await Promise.all([
		prisma.period.findMany({
			where,
			orderBy: { start: "asc" },
			skip: offset,
			take: limit,
			include: {
				roles: {
					include: {
						permissions: true,
					},
				},
			},
		}),
		prisma.period.count({ where }),
	]);

	return { periods, total };
}
