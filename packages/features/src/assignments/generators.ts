import {
	shiftOccurrenceAssignments,
	shiftOccurrences,
	shiftScheduleAssignments,
} from "@ecehive/drizzle";
import { and, eq, inArray } from "drizzle-orm";
import type { Transaction } from "../types/transaction";

/**
 * Assign a user to all occurrences of a shift schedule.
 *
 * This function creates shift occurrence assignments for all existing occurrences
 * of the specified shift schedule. It should be called when a user registers
 * for a recurring shift schedule.
 *
 * @param tx - The database transaction to use
 * @param shiftScheduleId - The ID of the shift schedule
 * @param userId - The ID of the user to assign
 */
export async function assignUserToScheduleOccurrences(
	tx: Transaction,
	shiftScheduleId: number,
	userId: number,
) {
	// Get all occurrences for this schedule
	const occurrences = await tx
		.select()
		.from(shiftOccurrences)
		.where(eq(shiftOccurrences.shiftScheduleId, shiftScheduleId));

	if (occurrences.length === 0) {
		return;
	}

	// Check if user is already assigned to any occurrences
	const existingAssignments = await tx
		.select()
		.from(shiftOccurrenceAssignments)
		.where(eq(shiftOccurrenceAssignments.userId, userId));

	// Filter out occurrences where user is already assigned
	const existingOccurrenceIds = new Set(
		existingAssignments.map((a) => a.shiftOccurrenceId),
	);

	const occurrencesToAssign = occurrences.filter(
		(occ) => !existingOccurrenceIds.has(occ.id),
	);

	if (occurrencesToAssign.length === 0) {
		return;
	}

	// Create assignments for all occurrences
	await tx.insert(shiftOccurrenceAssignments).values(
		occurrencesToAssign.map((occurrence) => ({
			shiftOccurrenceId: occurrence.id,
			userId,
			status: "assigned" as const,
		})),
	);
}

/**
 * Remove a user's assignments from all occurrences of a shift schedule.
 *
 * This function deletes all shift occurrence assignments for the specified
 * user and shift schedule. It should be called when a user unregisters
 * from a recurring shift schedule.
 *
 * @param tx - The database transaction to use
 * @param shiftScheduleId - The ID of the shift schedule
 * @param userId - The ID of the user to unassign
 */
export async function unassignUserFromScheduleOccurrences(
	tx: Transaction,
	shiftScheduleId: number,
	userId: number,
) {
	// Get all occurrences for this schedule
	const occurrences = await tx
		.select()
		.from(shiftOccurrences)
		.where(eq(shiftOccurrences.shiftScheduleId, shiftScheduleId));

	if (occurrences.length === 0) {
		return;
	}

	const occurrenceIds = occurrences.map((occ) => occ.id);

	// Delete all assignments for this user and these occurrences
	await tx
		.delete(shiftOccurrenceAssignments)
		.where(
			and(
				eq(shiftOccurrenceAssignments.userId, userId),
				inArray(shiftOccurrenceAssignments.shiftOccurrenceId, occurrenceIds),
			),
		);
}

/**
 * Regenerate occurrence assignments for a shift schedule.
 *
 * This function ensures that all users assigned to a shift schedule
 * are also assigned to all current occurrences of that schedule.
 * It should be called when occurrences are regenerated.
 *
 * @param tx - The database transaction to use
 * @param shiftScheduleId - The ID of the shift schedule
 */
export async function regenerateScheduleOccurrenceAssignments(
	tx: Transaction,
	shiftScheduleId: number,
) {
	// Get all users assigned to this schedule
	const scheduleAssignments = await tx
		.select()
		.from(shiftScheduleAssignments)
		.where(eq(shiftScheduleAssignments.shiftScheduleId, shiftScheduleId));

	// For each assigned user, ensure they're assigned to all occurrences
	for (const assignment of scheduleAssignments) {
		await assignUserToScheduleOccurrences(
			tx,
			shiftScheduleId,
			assignment.userId,
		);
	}
}
