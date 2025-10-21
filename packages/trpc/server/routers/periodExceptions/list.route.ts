import { db, periodExceptions } from "@ecehive/drizzle";
import { and, count, eq, ilike, type SQL } from "drizzle-orm";
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

	const filters = [eq(periodExceptions.periodId, periodId)] as (
		| SQL
		| undefined
	)[];

	if (search) {
		const escapeLike = (s: string) =>
			s.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
		const pattern = `%${escapeLike(search)}%`;
		filters.push(ilike(periodExceptions.name, pattern));
	}

	const whereClause = and(...filters);

	const result = await db
		.select()
		.from(periodExceptions)
		.where(whereClause)
		.limit(limit)
		.offset(offset)
		.orderBy(periodExceptions.start);

	const [total] = await db
		.select({ count: count(periodExceptions.id) })
		.from(periodExceptions)
		.where(whereClause);

	return { periodExceptions: result, total: total?.count ?? 0 };
}
