import { cancelReservation } from "@ecehive/features";
import { prisma } from "@ecehive/prisma";
import { z } from "zod";
import type { TProtectedProcedureContext } from "../../../trpc";

export const ZCancelReservationSchema = z.object({
	id: z.string().uuid(),
});

type CancelReservationOptions = {
	ctx: TProtectedProcedureContext;
	input: z.infer<typeof ZCancelReservationSchema>;
};

export async function cancelReservationHandler({
	ctx,
	input,
}: CancelReservationOptions) {
	// Check if user has manage permission (admin)
	const hasManagePermission = ctx.user.isSystemUser
		? true
		: !!(await prisma.permission.findFirst({
				where: {
					name: "control.reservations.manage",
					roles: {
						some: { users: { some: { id: ctx.user.id } } },
					},
				},
			}));

	return cancelReservation({
		reservationId: input.id,
		userId: ctx.user.id,
		isAdmin: hasManagePermission,
	});
}
