import { db, kiosks } from "@ecehive/drizzle";
import { eq } from "drizzle-orm";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZDeleteSchema = z.object({ id: z.number().min(1) });
export type TDeleteSchema = z.infer<typeof ZDeleteSchema>;

export type TDeleteOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TDeleteSchema;
};

export async function deleteHandler(options: TDeleteOptions) {
	const { id } = options.input;

	const deleted = await db.delete(kiosks).where(eq(kiosks.id, id)).returning();

	return { kiosk: deleted[0] };
}
