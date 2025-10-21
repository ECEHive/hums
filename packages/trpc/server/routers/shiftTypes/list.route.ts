import { db, shiftTypes } from "@ecehive/drizzle";
import { and, count, eq, ilike, or, type SQL } from "drizzle-orm";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZListSchema = z.object({
	limit: z.number().min(1).max(100).optional(),
	offset: z.number().min(0).optional(),
	periodId: z.number().min(1).optional(),
	search: z.string().min(1).max(100).optional(),
});

export type TListSchema = z.infer<typeof ZListSchema>;

export type TListOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TListSchema;
};

export async function listHandler(options: TListOptions) {
	const { limit = 10, offset = 0, periodId, search } = options.input;

	const filters = [] as (SQL | undefined)[];

	if (periodId) {
		filters.push(eq(shiftTypes.periodId, periodId));
	}

	if (search) {
		const escapeLike = (s: string) =>
			s.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
		const pattern = `%${escapeLike(search)}%`;
		filters.push(
			or(
				ilike(shiftTypes.name, pattern),
				ilike(shiftTypes.description, pattern),
				ilike(shiftTypes.location, pattern),
			),
		);
	}

	const whereClause = and(...filters);

	const result = await db
		.select()
		.from(shiftTypes)
		.where(whereClause)
		.limit(limit)
		.offset(offset)
		.orderBy(shiftTypes.name);

	const [total] = await db
		.select({ count: count(shiftTypes.id) })
		.from(shiftTypes)
		.where(whereClause);

	return { shiftTypes: result, total: total?.count ?? 0 };
}
