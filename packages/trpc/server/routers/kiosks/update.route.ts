import { db, kiosks } from "@ecehive/drizzle";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZUpdateSchema = z.object({
	id: z.number().min(1),
	name: z.string().min(1).max(100),
	ipAddress: z.string().min(7).max(45), // IPv4 or IPv6
	isActive: z.boolean(),
});

export type TUpdateSchema = z.infer<typeof ZUpdateSchema>;

export type TUpdateOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TUpdateSchema;
};

export async function updateHandler(options: TUpdateOptions) {
	const { id, name, ipAddress, isActive } = options.input;

	const [updated] = await db
		.update(kiosks)
		.set({ name, ipAddress, isActive, updatedAt: new Date() })
		.where(eq(kiosks.id, id))
		.returning();

	if (!updated) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: `Kiosk with id ${id} not found`,
		});
	}

	return { kiosk: updated };
}
