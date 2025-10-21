import { db, shiftOccurrenceAssignments } from "@ecehive/drizzle";
import { and, count, eq, type SQL } from "drizzle-orm";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZListSchema = z.object({
	limit: z.number().min(1).max(100).optional(),
	offset: z.number().min(0).optional(),
	shiftOccurrenceId: z.number().min(1).optional(),
	userId: z.number().min(1).optional(),
});

export type TListSchema = z.infer<typeof ZListSchema>;

export type TListOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TListSchema;
};

export async function listHandler(options: TListOptions) {
	const { limit = 10, offset = 0, shiftOccurrenceId, userId } = options.input;

	const filters = [] as (SQL | undefined)[];

	if (shiftOccurrenceId) {
		filters.push(
			eq(shiftOccurrenceAssignments.shiftOccurrenceId, shiftOccurrenceId),
		);
	}

	if (userId) {
		filters.push(eq(shiftOccurrenceAssignments.userId, userId));
	}

	const whereClause = and(...filters);

	const result = await db
		.select()
		.from(shiftOccurrenceAssignments)
		.where(whereClause)
		.limit(limit)
		.offset(offset)
		.orderBy(shiftOccurrenceAssignments.createdAt);

	const [total] = await db
		.select({ count: count(shiftOccurrenceAssignments.id) })
		.from(shiftOccurrenceAssignments)
		.where(whereClause);

	return { shiftOccurrenceAssignments: result, total: total?.count ?? 0 };
}
