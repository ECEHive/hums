import { db, userRoles } from "@ecehive/drizzle";
import { eq } from "drizzle-orm";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZUpdateSchema = z.object({
	id: z.number().min(1),
	userId: z.number().min(1),
	roleId: z.number().min(1),
});
export type TUpdateSchema = z.infer<typeof ZUpdateSchema>;

export type TUpdateOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TUpdateSchema;
};

export async function updateHandler(options: TUpdateOptions) {
	const { id, userId, roleId } = options.input;

	const updated = await db
		.update(userRoles)
		.set({ userId, roleId })
		.where(eq(userRoles.id, id))
		.returning();

	return { userRole: updated[0] };
}
