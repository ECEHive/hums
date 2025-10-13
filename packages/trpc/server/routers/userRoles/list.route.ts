import { db, userRoles } from "@ecehive/drizzle";
import { and, count, eq, type SQL } from "drizzle-orm";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZListSchema = z.object({
	userId: z.number().min(1).optional(),
	roleId: z.number().min(1).optional(),
	limit: z.number().min(1).max(100).optional(),
	offset: z.number().min(0).optional(),
});

export type TListSchema = z.infer<typeof ZListSchema>;

export type TListOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TListSchema;
};

export async function listHandler(options: TListOptions) {
	const { userId, roleId, limit = 10, offset = 0 } = options.input;

	const filters = [] as (SQL | undefined)[];

	if (userId) filters.push(eq(userRoles.userId, userId));
	if (roleId) filters.push(eq(userRoles.roleId, roleId));

	const result = await db
		.select()
		.from(userRoles)
		.where(and(...filters))
		.limit(limit)
		.offset(offset)
		.orderBy(userRoles.id);

	const [total] = await db
		.select({ count: count(userRoles.id) })
		.from(userRoles)
		.where(and(...filters));

	return { userRoles: result, total: total?.count ?? 0 };
}
