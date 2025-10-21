import { shiftSchedules, shiftTypes } from "@ecehive/drizzle";
import { eq } from "drizzle-orm";
import { generateShiftScheduleShiftOccurrences } from "../shift-schedules/generate";
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
 */
export async function generatePeriodShiftOccurrences(
	tx: Transaction,
	periodId: number,
) {
	// Get all shift types for this period
	const periodShiftTypes = await tx
		.select()
		.from(shiftTypes)
		.where(eq(shiftTypes.periodId, periodId));

	// For each shift type, get all its shift schedules
	for (const shiftType of periodShiftTypes) {
		const schedules = await tx
			.select()
			.from(shiftSchedules)
			.where(eq(shiftSchedules.shiftTypeId, shiftType.id));

		// Generate shift occurrences for each schedule
		for (const schedule of schedules) {
			await generateShiftScheduleShiftOccurrences(tx, schedule.id);
		}
	}
}
