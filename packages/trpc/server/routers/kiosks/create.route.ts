import { db, kiosks } from "@ecehive/drizzle";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZCreateSchema = z.object({
	name: z.string().min(1).max(100),
	ipAddress: z.string().min(7).max(45), // IPv4 or IPv6
	isActive: z.boolean().optional().default(true),
});

export type TCreateSchema = z.infer<typeof ZCreateSchema>;

export type TCreateOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TCreateSchema;
};

export async function createHandler(options: TCreateOptions) {
	const { name, ipAddress, isActive } = options.input;

	const [newKiosk] = await db
		.insert(kiosks)
		.values({
			name,
			ipAddress,
			isActive,
		})
		.returning();

	return { kiosk: newKiosk };
}
