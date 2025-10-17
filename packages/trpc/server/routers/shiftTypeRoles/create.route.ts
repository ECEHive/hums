import { db, shiftTypeRoles } from "@ecehive/drizzle";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZCreateSchema = z.object({
	shiftTypeId: z.number().min(1),
	roleId: z.number().min(1),
});

export type TCreateSchema = z.infer<typeof ZCreateSchema>;

export type TCreateOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TCreateSchema;
};

export async function createHandler(options: TCreateOptions) {
	const { shiftTypeId, roleId } = options.input;

	const inserted = await db
		.insert(shiftTypeRoles)
		.values({ shiftTypeId, roleId })
		.returning();

	return { shiftTypeRole: inserted[0] };
}
