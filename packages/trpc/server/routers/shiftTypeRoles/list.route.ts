import { db, shiftTypeRoles } from "@ecehive/drizzle";
import { and, count, eq, type SQL } from "drizzle-orm";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZListSchema = z.object({
	limit: z.number().min(1).max(100).optional(),
	offset: z.number().min(0).optional(),
	shiftTypeId: z.number().min(1).optional(),
	roleId: z.number().min(1).optional(),
});

export type TListSchema = z.infer<typeof ZListSchema>;

export type TListOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TListSchema;
};

export async function listHandler(options: TListOptions) {
	const { limit = 10, offset = 0, shiftTypeId, roleId } = options.input;

	const filters = [] as (SQL | undefined)[];

	if (shiftTypeId) {
		filters.push(eq(shiftTypeRoles.shiftTypeId, shiftTypeId));
	}

	if (roleId) {
		filters.push(eq(shiftTypeRoles.roleId, roleId));
	}

	const whereClause = and(...filters);

	const result = await db
		.select()
		.from(shiftTypeRoles)
		.where(whereClause)
		.limit(limit)
		.offset(offset)
		.orderBy(shiftTypeRoles.id);

	const [total] = await db
		.select({ count: count(shiftTypeRoles.id) })
		.from(shiftTypeRoles)
		.where(whereClause);

	return { shiftTypeRoles: result, total: total?.count ?? 0 };
}
