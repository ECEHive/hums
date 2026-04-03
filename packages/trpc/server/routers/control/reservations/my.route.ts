import { listReservations } from "@ecehive/features";
import { z } from "zod";
import type { TProtectedProcedureContext } from "../../../trpc";

export const ZMyReservationsSchema = z.object({
	status: z
		.enum(["PENDING", "ACTIVE", "COMPLETED", "CANCELLED", "NO_SHOW"])
		.or(
			z.array(
				z.enum(["PENDING", "ACTIVE", "COMPLETED", "CANCELLED", "NO_SHOW"]),
			),
		)
		.optional(),
	page: z.number().int().min(1).optional(),
	pageSize: z.number().int().min(1).max(100).optional(),
});

type MyReservationsOptions = {
	ctx: TProtectedProcedureContext;
	input: z.infer<typeof ZMyReservationsSchema>;
};

export async function myReservationsHandler({
	ctx,
	input,
}: MyReservationsOptions) {
	return listReservations({
		userId: ctx.user.id,
		status: input.status,
		page: input.page,
		pageSize: input.pageSize,
	});
}
