import { prisma } from "@ecehive/prisma";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZCreateSchema = z.object({
	name: z.string().min(1).max(100),
	ipAddress: z.union([z.ipv4(), z.ipv6()]),
	isActive: z.boolean().optional().default(true),
});

export type TCreateSchema = z.infer<typeof ZCreateSchema>;

export type TCreateOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TCreateSchema;
};

export async function createHandler(options: TCreateOptions) {
	const { name, ipAddress, isActive } = options.input;

	const newKiosk = await prisma.kiosk.create({
		data: {
			name,
			ipAddress,
			isActive,
		},
	});

	return { kiosk: newKiosk };
}
