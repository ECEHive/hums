import { computeAvailableSlots } from "@ecehive/features";
import { prisma } from "@ecehive/prisma";
import z from "zod";
import type { TProtectedProcedureContext } from "../../trpc";

export const ZAvailableSlotsSchema = z.object({
	instantEventTypeId: z.number().min(1),
	dateRangeStart: z.date(),
	dateRangeEnd: z.date(),
	slotIntervalMinutes: z.number().min(5).max(60).optional(),
});

export type TAvailableSlotsSchema = z.infer<typeof ZAvailableSlotsSchema>;

export type TAvailableSlotsOptions = {
	ctx: TProtectedProcedureContext;
	input: TAvailableSlotsSchema;
};

export async function availableSlotsHandler(options: TAvailableSlotsOptions) {
	const {
		instantEventTypeId,
		dateRangeStart,
		dateRangeEnd,
		slotIntervalMinutes,
	} = options.input;
	const requestorId = options.ctx.user.id;

	// Use a read-only transaction for consistent snapshot
	const slots = await prisma.$transaction(async (tx) => {
		return computeAvailableSlots(
			tx,
			instantEventTypeId,
			dateRangeStart,
			dateRangeEnd,
			slotIntervalMinutes,
			requestorId,
		);
	});

	return { slots };
}
