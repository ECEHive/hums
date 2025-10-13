import { db, roles } from "@ecehive/drizzle";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZCreateSchema = z.object({ name: z.string().min(1).max(200) });
export type TCreateSchema = z.infer<typeof ZCreateSchema>;

export type TCreateOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TCreateSchema;
};

export async function createHandler(options: TCreateOptions) {
	const { name } = options.input;

	const inserted = await db.insert(roles).values({ name }).returning();

	return { role: inserted[0] };
}
