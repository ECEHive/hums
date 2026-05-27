import { generatePeriodShiftOccurrences } from "@ecehive/features";
import { prisma } from "@ecehive/prisma";
import type { TPermissionProtectedProcedureContext } from "@ecehive/trpc/server";
import z from "zod";

export const ZDeleteSchema = z.object({
	id: z.number().min(1),
});

export type TDeleteSchema = z.infer<typeof ZDeleteSchema>;

export type TDeleteOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TDeleteSchema;
};

export async function deleteHandler(options: TDeleteOptions) {
	const { id } = options.input;

	return await prisma.$transaction(async (tx) => {
		// Get the exception to find its period
		const existing = await tx.periodException.findUnique({
			where: { id },
		});

		if (!existing) {
			return { success: false };
		}

		const periodId = existing.periodId;

		await tx.periodException.delete({
			where: { id },
		});

		// Regenerate shift occurrences for the period since exception is removed
		// Use skipPastOccurrences: true to avoid recreating past occurrences
		// that were deleted when the exception was created
		await generatePeriodShiftOccurrences(tx, periodId, {
			skipPastOccurrences: true,
		});

		return { success: true };
	});
}
