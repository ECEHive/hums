import { db, userRoles } from "@ecehive/drizzle";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZCreateSchema = z.object({
	userId: z.number().min(1),
	roleId: z.number().min(1),
});
export type TCreateSchema = z.infer<typeof ZCreateSchema>;

export type TCreateOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TCreateSchema;
};

export async function createHandler(options: TCreateOptions) {
	const { userId, roleId } = options.input;

	const inserted = await db
		.insert(userRoles)
		.values({ userId, roleId })
		.returning();

	return { userRole: inserted[0] };
}
