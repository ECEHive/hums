import {
	periodExceptions,
	periods,
	shiftOccurrences,
	shiftSchedules,
	shiftTypes,
} from "@ecehive/drizzle";
import { TRPCError } from "@trpc/server";
import { eq, inArray } from "drizzle-orm";
import type { Transaction } from "../types/transaction";
import {
	compareTimestamps,
	filterExceptionPeriods,
	generateOccurrenceTimestamps,
} from "./utils";

/**
 * Generate all the shift occurrences for a shift schedule.
 *
 * This function will create shift occurrences for all shifts
 * that belong to the specified shift schedule. It should be called
 * whenever a new shift schedule is created or an existing shift schedule
 * is updated.
 * This can also be used when a parent period is created or updated.
 *
 * @param tx - The database transaction to use.
 * @param shiftScheduleId - The ID of the shift schedule to generate shift occurrences for.
 * @throws Error if the shift schedule doesn't exist or if occurrence generation fails
 */
export async function generateShiftScheduleShiftOccurrences(
	tx: Transaction,
	shiftScheduleId: number,
) {
	// Get the shift schedule with its shift type and period
	const [schedule] = await tx
		.select({
			id: shiftSchedules.id,
			dayOfWeek: shiftSchedules.dayOfWeek,
			startTime: shiftSchedules.startTime,
			endTime: shiftSchedules.endTime,
			slot: shiftSchedules.slot,
			shiftTypeId: shiftSchedules.shiftTypeId,
			periodId: shiftTypes.periodId,
			periodStart: periods.start,
			periodEnd: periods.end,
		})
		.from(shiftSchedules)
		.innerJoin(shiftTypes, eq(shiftSchedules.shiftTypeId, shiftTypes.id))
		.innerJoin(periods, eq(shiftTypes.periodId, periods.id))
		.where(eq(shiftSchedules.id, shiftScheduleId));

	if (!schedule) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: `Shift schedule with ID ${shiftScheduleId} not found`,
		});
	}

	// Get period exceptions
	const exceptions = await tx
		.select({
			start: periodExceptions.start,
			end: periodExceptions.end,
		})
		.from(periodExceptions)
		.where(eq(periodExceptions.periodId, schedule.periodId));

	// Generate all expected occurrence timestamps for this schedule
	let expectedTimestamps = generateOccurrenceTimestamps(
		schedule.periodStart,
		schedule.periodEnd,
		schedule.dayOfWeek,
		schedule.startTime,
	);

	// Filter out occurrences that fall within exception periods
	expectedTimestamps = filterExceptionPeriods(expectedTimestamps, exceptions);

	// Get existing occurrences
	const existingOccurrences = await tx
		.select()
		.from(shiftOccurrences)
		.where(eq(shiftOccurrences.shiftScheduleId, shiftScheduleId));

	// Determine which occurrences to create and which to delete
	const { timestampsToCreate, timestampsToDelete } = compareTimestamps(
		expectedTimestamps,
		existingOccurrences.map((occ) => occ.timestamp),
	);

	// Find the IDs of occurrences to delete (all slots for those timestamps)
	const occurrenceIdsToDelete = existingOccurrences
		.filter((occ) =>
			timestampsToDelete.some(
				(ts) => ts.toISOString() === occ.timestamp.toISOString(),
			),
		)
		.map((occ) => occ.id);

	// Delete obsolete occurrences
	if (occurrenceIdsToDelete.length > 0) {
		await tx
			.delete(shiftOccurrences)
			.where(inArray(shiftOccurrences.id, occurrenceIdsToDelete));
	}

	// Create new occurrences - one for each slot
	// If slot = 3, create occurrences with slot 0, 1, 2 for each timestamp
	if (timestampsToCreate.length > 0) {
		const occurrencesToInsert = [];
		const numSlots = schedule.slot + 1; // slot is 0-indexed, so add 1

		for (const timestamp of timestampsToCreate) {
			for (let slotNum = 0; slotNum < numSlots; slotNum++) {
				occurrencesToInsert.push({
					shiftScheduleId: shiftScheduleId,
					timestamp: timestamp,
					slot: slotNum,
				});
			}
		}

		const result = await tx
			.insert(shiftOccurrences)
			.values(occurrencesToInsert)
			.returning();

		// Verify all occurrences were created
		if (result.length !== occurrencesToInsert.length) {
			throw new TRPCError({
				code: "INTERNAL_SERVER_ERROR",
				message: `Failed to create all shift occurrences. Expected ${occurrencesToInsert.length}, created ${result.length}`,
			});
		}
	}
}
