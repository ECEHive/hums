import { db, shiftSchedules, shiftTypes } from "@ecehive/drizzle";
import { and, count, eq, type SQL } from "drizzle-orm";
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
		.select({ schedule: shiftSchedules })
		.from(shiftSchedules)
		.innerJoin(shiftTypes, eq(shiftSchedules.shiftTypeId, shiftTypes.id))
		.where(whereClause)
		.limit(limit)
		.offset(offset)
		.orderBy(shiftSchedules.dayOfWeek, shiftSchedules.startTime);

	const schedules = rows.map((row) => row.schedule);

	const [total] = await db
		.select({ count: count(shiftSchedules.id) })
		.from(shiftSchedules)
		.innerJoin(shiftTypes, eq(shiftSchedules.shiftTypeId, shiftTypes.id))
		.where(whereClause);

	return { shiftSchedules: schedules, total: total?.count ?? 0 };
}
