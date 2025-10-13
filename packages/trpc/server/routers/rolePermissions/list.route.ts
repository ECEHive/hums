import { db, rolePermissions } from "@ecehive/drizzle";
import { and, count, eq, type SQL } from "drizzle-orm";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZListSchema = z.object({
	roleId: z.number().min(1),
	limit: z.number().min(1).max(100).optional(),
	offset: z.number().min(0).optional(),
});

export type TListSchema = z.infer<typeof ZListSchema>;

export type TListOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TListSchema;
};

export async function listHandler(options: TListOptions) {
	const { roleId, limit = 10, offset = 0 } = options.input;

	const filters = [eq(rolePermissions.roleId, roleId)] as (SQL | undefined)[];

	const result = await db
		.select()
		.from(rolePermissions)
		.where(and(...filters))
		.limit(limit)
		.offset(offset)
		.orderBy(rolePermissions.id);

	const [total] = await db
		.select({ count: count(rolePermissions.id) })
		.from(rolePermissions)
		.where(and(...filters));

	return { rolePermissions: result, total: total?.count ?? 0 };
}
