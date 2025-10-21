import { db, rolePermissions } from "@ecehive/drizzle";
import { eq } from "drizzle-orm";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZUpdateSchema = z.object({
	id: z.number().min(1),
	roleId: z.number().min(1),
	permissionId: z.number().min(1),
});
export type TUpdateSchema = z.infer<typeof ZUpdateSchema>;

export type TUpdateOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TUpdateSchema;
};

export async function updateHandler(options: TUpdateOptions) {
	const { id, roleId, permissionId } = options.input;

	const updated = await db
		.update(rolePermissions)
		.set({ roleId, permissionId })
		.where(eq(rolePermissions.id, id))
		.returning();

	return { rolePermission: updated[0] };
}
