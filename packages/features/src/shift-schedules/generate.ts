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

	// Also check for slot count changes - need to delete/create occurrences
	// when the slot count has changed
	const totalSlots = schedule.slot + 1; // slot is 0-indexed, so add 1

	// Find occurrences with invalid slot numbers (slot >= totalSlots)
	const occurrencesWithInvalidSlots = existingOccurrences.filter(
		(occ) => occ.slot >= totalSlots,
	);

	// Find timestamps that need new slots created (not enough slots for the current count)
	const timestampSlotCounts = new Map<string, number>();
	for (const occ of existingOccurrences) {
		const tsKey = occ.timestamp.toISOString();
		const maxSlot = timestampSlotCounts.get(tsKey) ?? -1;
		timestampSlotCounts.set(tsKey, Math.max(maxSlot, occ.slot));
	}

	const timestampsNeedingMoreSlots: Date[] = [];
	for (const tsKey of Array.from(timestampSlotCounts.keys())) {
		const maxSlot = timestampSlotCounts.get(tsKey);
		if (maxSlot === undefined) continue;

		// If max slot in DB is less than what we need, we need to create more
		if (maxSlot < schedule.slot) {
			const timestamp = new Date(tsKey);
			// Only if this timestamp is still valid (not being deleted)
			if (
				!timestampsToDelete.some(
					(ts) => ts.toISOString() === timestamp.toISOString(),
				)
			) {
				timestampsNeedingMoreSlots.push(timestamp);
			}
		}
	}

	// Find the IDs of occurrences to delete
	const occurrenceIdsToDelete = [
		// Occurrences for deleted timestamps
		...existingOccurrences
			.filter((occ) =>
				timestampsToDelete.some(
					(ts) => ts.toISOString() === occ.timestamp.toISOString(),
				),
			)
			.map((occ) => occ.id),
		// Occurrences with invalid slot numbers
		...occurrencesWithInvalidSlots.map((occ) => occ.id),
	];

	// Delete obsolete occurrences
	if (occurrenceIdsToDelete.length > 0) {
		await tx
			.delete(shiftOccurrences)
			.where(inArray(shiftOccurrences.id, occurrenceIdsToDelete));
	}

	// Create new occurrences
	const occurrencesToInsert = [];

	// Create occurrences for brand new timestamps (all slots)
	for (const timestamp of timestampsToCreate) {
		for (let slotNum = 0; slotNum < totalSlots; slotNum++) {
			occurrencesToInsert.push({
				shiftScheduleId: shiftScheduleId,
				timestamp: timestamp,
				slot: slotNum,
			});
		}
	}

	// Create additional slot occurrences for existing timestamps that need more slots
	for (const timestamp of timestampsNeedingMoreSlots) {
		const tsKey = timestamp.toISOString();
		const currentMaxSlot = timestampSlotCounts.get(tsKey) ?? -1;

		// Create missing slots (from currentMaxSlot + 1 to schedule.slot)
		for (let slotNum = currentMaxSlot + 1; slotNum < totalSlots; slotNum++) {
			occurrencesToInsert.push({
				shiftScheduleId: shiftScheduleId,
				timestamp: timestamp,
				slot: slotNum,
			});
		}
	}

	if (occurrencesToInsert.length > 0) {
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
