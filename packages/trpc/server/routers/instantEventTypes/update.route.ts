import { prisma } from "@ecehive/prisma";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZUpdateSchema = z.object({
	id: z.number().min(1),
	name: z.string().min(1).max(200).optional(),
	description: z.string().min(1).max(2000).optional().nullable(),
	isActive: z.boolean().optional(),
	durationMinutes: z.number().min(5).max(480).optional(),
	minSchedulers: z.number().min(1).max(50).optional(),
	bookingWindowStart: z.date().optional().nullable(),
	bookingWindowEnd: z.date().optional().nullable(),
	loadBalancing: z
		.enum(["none", "round_robin", "even_distribution"])
		.optional(),
	schedulerRoleIds: z.array(z.number().min(1)).optional(),
	participantRoleIds: z.array(z.number().min(1)).optional(),
	requiredRoleIds: z.array(z.number().min(1)).optional(),
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
		description,
		isActive,
		durationMinutes,
		minSchedulers,
		bookingWindowStart,
		bookingWindowEnd,
		loadBalancing,
		schedulerRoleIds,
		participantRoleIds,
		requiredRoleIds,
	} = options.input;

	const eventType = await prisma.instantEventType.update({
		where: { id },
		data: {
			...(name !== undefined && { name }),
			...(description !== undefined && { description }),
			...(isActive !== undefined && { isActive }),
			...(durationMinutes !== undefined && { durationMinutes }),
			...(minSchedulers !== undefined && { minSchedulers }),
			...(bookingWindowStart !== undefined && { bookingWindowStart }),
			...(bookingWindowEnd !== undefined && { bookingWindowEnd }),
			...(loadBalancing !== undefined && { loadBalancing }),
			...(schedulerRoleIds !== undefined
				? {
						schedulerRoles: {
							set: schedulerRoleIds.map((roleId) => ({ id: roleId })),
						},
					}
				: {}),
			...(participantRoleIds !== undefined
				? {
						participantRoles: {
							set: participantRoleIds.map((roleId) => ({ id: roleId })),
						},
					}
				: {}),
			...(requiredRoleIds !== undefined
				? {
						requiredRoles: {
							set: requiredRoleIds.map((roleId) => ({ id: roleId })),
						},
					}
				: {}),
		},
		include: {
			schedulerRoles: {
				select: { id: true, name: true },
				orderBy: { name: "asc" },
			},
			participantRoles: {
				select: { id: true, name: true },
				orderBy: { name: "asc" },
			},
			requiredRoles: {
				select: { id: true, name: true },
				orderBy: { name: "asc" },
			},
		},
	});

	return { eventType };
}
