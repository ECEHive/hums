import { prisma } from "@ecehive/prisma";
import type { TProtectedProcedureContext } from "../../trpc";

export type TBookableEventTypesOptions = {
	ctx: TProtectedProcedureContext;
};

/**
 * List active event types that the current user can book.
 * An event type is bookable if it has no participant role restrictions,
 * or if the user holds at least one of the required participant roles.
 */
export async function bookableEventTypesHandler(
	options: TBookableEventTypesOptions,
) {
	const userId = options.ctx.user.id;

	// Fetch the user's role IDs
	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: { roles: { select: { id: true } } },
	});

	const userRoleIds = user?.roles.map((r) => r.id) ?? [];

	// Fetch active event types where:
	// - No participant roles are set (open to everyone), OR
	// - The user has at least one of the participant roles
	const eventTypes = await prisma.instantEventType.findMany({
		where: {
			isActive: true,
			OR: [
				{ participantRoles: { none: {} } },
				...(userRoleIds.length > 0
					? [
							{
								participantRoles: {
									some: { id: { in: userRoleIds } },
								},
							},
						]
					: []),
			],
		},
		include: {
			schedulerRoles: {
				select: { id: true, name: true },
				orderBy: { name: "asc" as const },
			},
			participantRoles: {
				select: { id: true, name: true },
				orderBy: { name: "asc" as const },
			},
			requiredRoles: {
				select: { id: true, name: true },
				orderBy: { name: "asc" as const },
			},
		},
		orderBy: { name: "asc" },
	});

	return { eventTypes };
}
