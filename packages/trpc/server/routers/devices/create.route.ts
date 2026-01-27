import { prisma } from "@ecehive/prisma";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZCreateSchema = z.object({
	name: z.string().min(1).max(100),
	ipAddress: z.union([z.ipv4(), z.ipv6()]),
	isActive: z.boolean().optional().default(true),
	hasKioskAccess: z.boolean().optional().default(true),
	hasDashboardAccess: z.boolean().optional().default(false),
	hasInventoryAccess: z.boolean().optional().default(false),
});

export type TCreateSchema = z.infer<typeof ZCreateSchema>;

export type TCreateOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TCreateSchema;
};

export async function createHandler(options: TCreateOptions) {
	const {
		name,
		ipAddress,
		isActive,
		hasKioskAccess,
		hasDashboardAccess,
		hasInventoryAccess,
	} = options.input;

	const newDevice = await prisma.device.create({
		data: {
			name,
			ipAddress,
			isActive,
			hasKioskAccess,
			hasDashboardAccess,
			hasInventoryAccess,
		},
	});

	return { device: newDevice };
}
