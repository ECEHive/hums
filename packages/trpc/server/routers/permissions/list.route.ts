import { db, permissions } from "@ecehive/drizzle";
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
	const { search, limit, offset = 0 } = options.input;

	const filters = [] as (SQL | undefined)[];

	if (search) {
		filters.push(like(permissions.name, `%${search.replaceAll("%", "\\%")}%`));
	}

	const query = db
		.select()
		.from(permissions)
		.where(and(...filters))
		.offset(offset)
		.orderBy(permissions.name);

	if (limit) {
		query.limit(limit);
	}

	const result = await query;

	const [total] = await db
		.select({ count: count(permissions.id) })
		.from(permissions)
		.where(and(...filters));

	return { permissions: result, total: total?.count ?? 0 };
}
