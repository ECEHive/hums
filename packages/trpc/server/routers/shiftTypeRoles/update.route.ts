import { db, shiftTypeRoles } from "@ecehive/drizzle";
import { eq } from "drizzle-orm";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZUpdateSchema = z.object({
	id: z.number().min(1),
	shiftTypeId: z.number().min(1).optional(),
	roleId: z.number().min(1).optional(),
});

export type TUpdateSchema = z.infer<typeof ZUpdateSchema>;

export type TUpdateOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TUpdateSchema;
};

export async function updateHandler(options: TUpdateOptions) {
	const { id, shiftTypeId, roleId } = options.input;

	const updates: Partial<typeof shiftTypeRoles.$inferInsert> = {
		updatedAt: new Date(),
	};

	if (shiftTypeId !== undefined) {
		updates.shiftTypeId = shiftTypeId;
	}

	if (roleId !== undefined) {
		updates.roleId = roleId;
	}

	const updated = await db
		.update(shiftTypeRoles)
		.set(updates)
		.where(eq(shiftTypeRoles.id, id))
		.returning();

	return { shiftTypeRole: updated[0] };
}
