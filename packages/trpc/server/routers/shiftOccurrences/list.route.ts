import { db, shiftOccurrences } from "@ecehive/drizzle";
import { and, count, eq, gte, lte, type SQL } from "drizzle-orm";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZListSchema = z.object({
	limit: z.number().min(1).max(100).optional(),
	offset: z.number().min(0).optional(),
	shiftScheduleId: z.number().min(1).optional(),
	startDate: z.date().optional(),
	endDate: z.date().optional(),
});

export type TListSchema = z.infer<typeof ZListSchema>;

export type TListOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TListSchema;
};

export async function listHandler(options: TListOptions) {
	const {
		limit = 10,
		offset = 0,
		shiftScheduleId,
		startDate,
		endDate,
	} = options.input;

	const filters = [] as (SQL | undefined)[];

	if (shiftScheduleId) {
		filters.push(eq(shiftOccurrences.shiftScheduleId, shiftScheduleId));
	}

	if (startDate) {
		filters.push(gte(shiftOccurrences.timestamp, startDate));
	}

	if (endDate) {
		filters.push(lte(shiftOccurrences.timestamp, endDate));
	}

	const whereClause = and(...filters);

	const result = await db
		.select()
		.from(shiftOccurrences)
		.where(whereClause)
		.limit(limit)
		.offset(offset)
		.orderBy(shiftOccurrences.timestamp);

	const [total] = await db
		.select({ count: count(shiftOccurrences.id) })
		.from(shiftOccurrences)
		.where(whereClause);

	return { shiftOccurrences: result, total: total?.count ?? 0 };
}
