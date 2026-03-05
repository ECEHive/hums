import { prisma } from "@ecehive/prisma";
import type { TProtectedProcedureContext } from "../../trpc";

export type TCanSetAvailabilityOptions = {
	ctx: TProtectedProcedureContext;
	input: undefined;
};

/**
 * Check if the current user is a scheduler for any active instant event type,
 * meaning they are allowed to set their own availability.
 */
export async function canSetAvailabilityHandler(
	options: TCanSetAvailabilityOptions,
) {
	const userId = options.ctx.user.id;

	const eventWithUser = await prisma.instantEventType.findFirst({
		where: {
			isActive: true,
			schedulerRoles: {
				some: {
					users: {
						some: { id: userId },
					},
				},
			},
		},
		select: { id: true },
	});

	return { canSetAvailability: !!eventWithUser };
}
