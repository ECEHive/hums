import { db, sessions } from "@ecehive/drizzle";
import { and, countDistinct, desc, eq, type SQL } from "drizzle-orm";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZListSchema = z.object({
	limit: z.number().min(1).max(100).optional(),
	offset: z.number().min(0).optional(),
	filterUserId: z.number().min(1).optional(),
});

export type TListSchema = z.infer<typeof ZListSchema>;

export type TListOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TListSchema;
};

export async function listHandler(options: TListOptions) {
	const { filterUserId, limit, offset = 0 } = options.input;

	const filters = [] as (SQL | undefined)[];

	if (filterUserId) {
		filters.push(eq(sessions.userId, filterUserId));
	}

	const sessionsResult = await db
		.select()
		.from(sessions)
		.where(and(...filters))
		.limit(limit ?? 50)
		.offset(offset)
		.orderBy(desc(sessions.startedAt));

	const [total] = await db
		.select({
			count: countDistinct(sessions.id),
		})
		.from(sessions)
		.where(and(...filters));

	return {
		sessions: sessionsResult,
		total: total?.count ?? 0,
	};
}
