import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZUpdateSchema = z.object({
	id: z.number().min(1),
	name: z.string().min(1).max(100),
	ipAddress: z.union([z.ipv4(), z.ipv6()]),
	isActive: z.boolean(),
	hasKioskAccess: z.boolean(),
	hasDashboardAccess: z.boolean(),
	hasInventoryAccess: z.boolean(),
	hasControlAccess: z.boolean(),
	controlPointIds: z.array(z.string().uuid()).optional(),
});

export type TUpdateSchema = z.infer<typeof ZUpdateSchema>;

export type TUpdateOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TUpdateSchema;
};

export async function updateHandler(options: TUpdateOptions) {
	const {
		id,
		name,
		ipAddress,
		isActive,
		hasKioskAccess,
		hasDashboardAccess,
		hasInventoryAccess,
		hasControlAccess,
		controlPointIds,
	} = options.input;

	const updated = await prisma.device.update({
		where: { id },
		data: {
			name,
			ipAddress,
			isActive,
			hasKioskAccess,
			hasDashboardAccess,
			hasInventoryAccess,
			hasControlAccess,
			// Only update control points if provided
			...(controlPointIds !== undefined && {
				controlPoints: {
					set: controlPointIds.map((cpId) => ({ id: cpId })),
				},
			}),
		},
		include: {
			controlPoints: {
				select: { id: true, name: true },
			},
		},
	});

	if (!updated) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: `Device with id ${id} not found`,
		});
	}

	return { device: updated };
}
