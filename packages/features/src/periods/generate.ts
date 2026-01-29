import { TRPCError } from "@trpc/server";
import {
	type GenerateShiftOccurrencesOptions,
	generateShiftScheduleShiftOccurrences,
} from "../shift-schedules/generate";
import type { Transaction } from "../types/transaction";

/**
 * Generate all the shift occurrences for a period.
 *
 * This function will create shift occurrences for all shifts
 * that belong to the specified period. It should be called
 * whenever a new period is created or an existing period
 * is updated.
 *
 * @param tx - The database transaction to use.
 * @param periodId - The ID of the period to generate shift occurrences for.
 * @param options - Optional settings for occurrence generation.
 * @throws Error if the period doesn't exist or if occurrence generation fails
 */
export async function generatePeriodShiftOccurrences(
	tx: Transaction,
	periodId: number,
	options: GenerateShiftOccurrencesOptions = {},
) {
	// Get all shift types for this period with their shift schedules
	const periodShiftTypes = await tx.shiftType.findMany({
		where: { periodId },
		include: {
			shiftSchedules: true,
		},
	});

	if (periodShiftTypes.length === 0) {
		// No shift types found for this period - this is valid, just return
		return;
	}

	// For each shift type, generate shift occurrences for each schedule
	for (const shiftType of periodShiftTypes) {
		for (const schedule of shiftType.shiftSchedules) {
			try {
				await generateShiftScheduleShiftOccurrences(tx, schedule.id, options);
			} catch (error) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: `Failed to generate occurrences for schedule ${schedule.id}: ${error instanceof Error ? error.message : "Unknown error"}`,
				});
			}
		}
	}
}
