import { getReservation } from "@ecehive/features";
import { z } from "zod";

export const ZGetReservationSchema = z.object({
	id: z.string().uuid(),
});

export async function getReservationHandler({
	input,
}: {
	input: z.infer<typeof ZGetReservationSchema>;
}) {
	return getReservation(input.id);
}
