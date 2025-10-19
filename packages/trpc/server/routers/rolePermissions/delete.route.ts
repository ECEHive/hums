import { db, rolePermissions } from "@ecehive/drizzle";
import { eq, and } from "drizzle-orm";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZDeleteSchema = z.union([
	z.object({ id: z.number().min(1) }),
	z.object({ roleId: z.number().min(1), permissionId: z.number().min(1) })
]);
export type TDeleteSchema = z.infer<typeof ZDeleteSchema>;

export type TDeleteOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TDeleteSchema;
};

export async function deleteHandler(options: TDeleteOptions) {
	if ("roleId" in options.input && "permissionId" in options.input) {
		const { roleId, permissionId } = options.input;

		const res = db.delete(rolePermissions).where(
			and(
				eq(rolePermissions.roleId, roleId),
				eq(rolePermissions.permissionId, permissionId),
			),
		);

		await res;

		return { success: true };
	}
	else {
		const { id } = options.input as { id: number };

		await db.delete(rolePermissions).where(eq(rolePermissions.id, id));

		return { success: true };
	}
}
