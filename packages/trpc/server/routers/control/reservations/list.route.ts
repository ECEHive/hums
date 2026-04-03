import { listReservations } from "@ecehive/features";
import { z } from "zod";

export const ZListReservationsSchema = z.object({
	controlPointId: z.string().uuid().optional(),
	userId: z.number().int().optional(),
	status: z
		.enum(["PENDING", "ACTIVE", "COMPLETED", "CANCELLED", "NO_SHOW"])
		.or(
			z.array(
				z.enum(["PENDING", "ACTIVE", "COMPLETED", "CANCELLED", "NO_SHOW"]),
			),
		)
		.optional(),
	from: z.date().optional(),
	to: z.date().optional(),
	page: z.number().int().min(1).optional(),
	pageSize: z.number().int().min(1).max(100).optional(),
	orderBy: z.enum(["startTime", "createdAt"]).optional(),
	orderDir: z.enum(["asc", "desc"]).optional(),
});

export async function listReservationsHandler({
	input,
}: {
	input: z.infer<typeof ZListReservationsSchema>;
}) {
	return listReservations(input);
}
