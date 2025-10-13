import { db, rolePermissions } from "@ecehive/drizzle";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZCreateSchema = z.object({
	roleId: z.number().min(1),
	permissionId: z.number().min(1),
});
export type TCreateSchema = z.infer<typeof ZCreateSchema>;

export type TCreateOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TCreateSchema;
};

export async function createHandler(options: TCreateOptions) {
	const { roleId, permissionId } = options.input;

	const inserted = await db
		.insert(rolePermissions)
		.values({ roleId, permissionId })
		.returning();

	return { rolePermission: inserted[0] };
}
