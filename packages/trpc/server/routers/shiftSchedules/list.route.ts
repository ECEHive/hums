import {
	db,
	shiftScheduleAssignments,
	shiftSchedules,
	shiftTypes,
} from "@ecehive/drizzle";
import { and, count, eq, type SQL, sql } from "drizzle-orm";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZListSchema = z.object({
	limit: z.number().min(1).max(100).optional(),
	offset: z.number().min(0).optional(),
	shiftTypeId: z.number().min(1).optional(),
	periodId: z.number().min(1).optional(),
	dayOfWeek: z.number().min(0).max(6).optional(),
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
		shiftTypeId,
		periodId,
		dayOfWeek,
	} = options.input;

	const filters = [] as (SQL | undefined)[];

	if (shiftTypeId) {
		filters.push(eq(shiftSchedules.shiftTypeId, shiftTypeId));
	}

	if (periodId) {
		filters.push(eq(shiftTypes.periodId, periodId));
	}

	if (dayOfWeek !== undefined) {
		filters.push(eq(shiftSchedules.dayOfWeek, dayOfWeek));
	}

	const whereClause = and(...filters);

	const rows = await db
		.select({
			schedule: shiftSchedules,
			assignedCount: sql<number>`cast(count(distinct ${shiftScheduleAssignments.id}) as int)`,
		})
		.from(shiftSchedules)
		.innerJoin(shiftTypes, eq(shiftSchedules.shiftTypeId, shiftTypes.id))
		.leftJoin(
			shiftScheduleAssignments,
			eq(shiftSchedules.id, shiftScheduleAssignments.shiftScheduleId),
		)
		.where(whereClause)
		.groupBy(shiftSchedules.id)
		.limit(limit)
		.offset(offset)
		.orderBy(shiftSchedules.dayOfWeek, shiftSchedules.startTime);

	const schedulesWithCounts = rows.map((row) => ({
		...row.schedule,
		assignedUserCount: row.assignedCount,
	}));

	const [total] = await db
		.select({ count: count(shiftSchedules.id) })
		.from(shiftSchedules)
		.innerJoin(shiftTypes, eq(shiftSchedules.shiftTypeId, shiftTypes.id))
		.where(whereClause);

	return { shiftSchedules: schedulesWithCounts, total: total?.count ?? 0 };
}
