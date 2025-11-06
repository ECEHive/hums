import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZUpdateSchema = z.object({
	id: z.number().min(1),
	name: z.string().min(1).max(100),
	ipAddress: z.union([z.ipv4(), z.ipv6()]),
	isActive: z.boolean(),
});

export type TUpdateSchema = z.infer<typeof ZUpdateSchema>;

export type TUpdateOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TUpdateSchema;
};

export async function updateHandler(options: TUpdateOptions) {
	const { id, name, ipAddress, isActive } = options.input;

	const updated = await prisma.kiosk.update({
		where: { id },
		data: { name, ipAddress, isActive },
	});

	if (!updated) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: `Kiosk with id ${id} not found`,
		});
	}

	return { kiosk: updated };
}
