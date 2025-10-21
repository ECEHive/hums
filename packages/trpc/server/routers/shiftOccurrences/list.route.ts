import {
	db,
	shiftOccurrenceAssignments,
	shiftOccurrences,
} from "@ecehive/drizzle";
import { and, count, eq, gte, lte, type SQL, sql } from "drizzle-orm";
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

	const rows = await db
		.select({
			occurrence: shiftOccurrences,
			assignedCount: sql<number>`cast(count(distinct ${shiftOccurrenceAssignments.id}) as int)`,
		})
		.from(shiftOccurrences)
		.leftJoin(
			shiftOccurrenceAssignments,
			eq(shiftOccurrences.id, shiftOccurrenceAssignments.shiftOccurrenceId),
		)
		.where(whereClause)
		.groupBy(shiftOccurrences.id)
		.limit(limit)
		.offset(offset)
		.orderBy(shiftOccurrences.timestamp);

	const occurrencesWithCounts = rows.map((row) => ({
		...row.occurrence,
		assignedUserCount: row.assignedCount,
	}));

	const [total] = await db
		.select({ count: count(shiftOccurrences.id) })
		.from(shiftOccurrences)
		.where(whereClause);

	return { shiftOccurrences: occurrencesWithCounts, total: total?.count ?? 0 };
}
