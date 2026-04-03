import { createReservation } from "@ecehive/features";
import { z } from "zod";
import type { TProtectedProcedureContext } from "../../../trpc";

export const ZCreateReservationSchema = z.object({
	controlPointId: z.string().uuid(),
	startTime: z.date(),
	endTime: z.date(),
	notes: z.string().max(1000).optional(),
});

type CreateReservationOptions = {
	ctx: TProtectedProcedureContext;
	input: z.infer<typeof ZCreateReservationSchema>;
};

export async function createReservationHandler({
	ctx,
	input,
}: CreateReservationOptions) {
	return createReservation({
		controlPointId: input.controlPointId,
		userId: ctx.user.id,
		startTime: input.startTime,
		endTime: input.endTime,
		notes: input.notes,
	});
}
