import { type Prisma, prisma } from "@ecehive/prisma";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZListVisibleSchema = z.object({
	limit: z.number().min(1).max(100).optional(),
	offset: z.number().min(0).optional(),
});

export type TListVisibleSchema = z.infer<typeof ZListVisibleSchema>;

export type TListVisibleOptions = {
	ctx?: TPermissionProtectedProcedureContext;
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

	// Filter by visibility window - only return periods that are currently visible
	const where: Prisma.PeriodWhereInput = {
		AND: [{ visibleStart: { lte: now } }, { visibleEnd: { gte: now } }],
	};

	const [result, total] = await Promise.all([
		prisma.period.findMany({
			where,
			orderBy: { start: "asc" },
			skip: offset,
			take: limit,
		}),
		prisma.period.count({ where }),
	]);

	return { periods: result, total };
}
