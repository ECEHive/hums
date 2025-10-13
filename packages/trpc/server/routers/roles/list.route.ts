import { db, roles } from "@ecehive/drizzle";
import { and, count, like, type SQL } from "drizzle-orm";
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
		filters.push(like(roles.name, `%${search.replaceAll("%", "\\%")}%`));
	}

	const result = await db
		.select()
		.from(roles)
		.where(and(...filters))
		.limit(limit)
		.offset(offset)
		.orderBy(roles.name);

	const [total] = await db
		.select({ count: count(roles.id) })
		.from(roles)
		.where(and(...filters));

	return {
		roles: result,
		total: total?.count ?? 0,
	};
}
