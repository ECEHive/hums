import { db, roles } from "@ecehive/drizzle";
import { eq } from "drizzle-orm";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZGetSchema = z.object({ id: z.number().min(1) });
export type TGetSchema = z.infer<typeof ZGetSchema>;

export type TGetOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TGetSchema;
};

export async function getHandler(options: TGetOptions) {
	const { id } = options.input;

	const [role] = await db.select().from(roles).where(eq(roles.id, id));

	return { role };
}
