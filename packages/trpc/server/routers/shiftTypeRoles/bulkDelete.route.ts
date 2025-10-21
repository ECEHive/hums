import { db, shiftTypeRoles } from "@ecehive/drizzle";
import { and, eq, inArray } from "drizzle-orm";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZBulkDeleteSchema = z.object({
	shiftTypeId: z.number().min(1),
	roleIds: z.array(z.number().min(1)).min(1),
});

export type TBulkDeleteSchema = z.infer<typeof ZBulkDeleteSchema>;

export type TBulkDeleteOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TBulkDeleteSchema;
};

export async function bulkDeleteHandler(options: TBulkDeleteOptions) {
	const { shiftTypeId, roleIds } = options.input;

	const deleted = await db
		.delete(shiftTypeRoles)
		.where(
			and(
				eq(shiftTypeRoles.shiftTypeId, shiftTypeId),
				inArray(shiftTypeRoles.roleId, roleIds),
			),
		)
		.returning();

	return { shiftTypeRoles: deleted };
}
