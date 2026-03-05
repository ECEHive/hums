import { prisma } from "@ecehive/prisma";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZCreateSchema = z.object({
	name: z.string().min(1).max(200),
	description: z.string().min(1).max(2000).optional().nullable(),
	isActive: z.boolean().optional(),
	durationMinutes: z.number().min(5).max(480),
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

export type TCreateSchema = z.infer<typeof ZCreateSchema>;

export type TCreateOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TCreateSchema;
};

export async function createHandler(options: TCreateOptions) {
	const {
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

	const eventType = await prisma.instantEventType.create({
		data: {
			name,
			description: description ?? null,
			isActive: isActive ?? true,
			durationMinutes,
			minSchedulers: minSchedulers ?? 1,
			bookingWindowStart: bookingWindowStart ?? null,
			bookingWindowEnd: bookingWindowEnd ?? null,
			loadBalancing: loadBalancing ?? "none",
			...(schedulerRoleIds && schedulerRoleIds.length > 0
				? {
						schedulerRoles: { connect: schedulerRoleIds.map((id) => ({ id })) },
					}
				: {}),
			...(participantRoleIds && participantRoleIds.length > 0
				? {
						participantRoles: {
							connect: participantRoleIds.map((id) => ({ id })),
						},
					}
				: {}),
			...(requiredRoleIds && requiredRoleIds.length > 0
				? { requiredRoles: { connect: requiredRoleIds.map((id) => ({ id })) } }
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
