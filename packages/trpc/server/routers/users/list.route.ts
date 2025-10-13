import { db, users } from "@ecehive/drizzle";
import { and, count, like, or, type SQL } from "drizzle-orm";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZListSchema = z.object({
	limit: z.number().min(1).max(100).optional(),
	offset: z.number().min(0).optional(),
	search: z.string().min(1).max(100).optional(),
});

export type TListSchema = z.infer<typeof ZListSchema>;

export type TListOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TListSchema;
};

export async function listHandler(options: TListOptions) {
	const { search, limit = 10, offset = 0 } = options.input;

	const filters = [] as (SQL | undefined)[];

	if (search) {
		filters.push(
			or(
				like(users.name, `%${search.replaceAll("%", "\\%")}%`),
				like(users.username, `%${search.replaceAll("%", "\\%")}%`),
				like(users.email, `%${search.replaceAll("%", "\\%")}%`),
			),
		);
	}

	const result = await db
		.select()
		.from(users)
		.where(and(...filters))
		.limit(limit)
		.offset(offset)
		.orderBy(users.name);

	const [total] = await db
		.select({
			count: count(users.id),
		})
		.from(users)
		.where(and(...filters));

	return {
		users: result,
		total: total?.count ?? 0,
	};
}
