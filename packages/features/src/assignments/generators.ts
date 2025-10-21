import {
	shiftOccurrenceAssignments,
	shiftOccurrences,
	shiftScheduleAssignments,
	shiftSchedules,
} from "@ecehive/drizzle";
import { TRPCError } from "@trpc/server";
import { and, eq, inArray } from "drizzle-orm";
import type { Transaction } from "../types/transaction";

/**
 * Assign a user to all occurrences of a shift schedule.
 *
 * This function creates shift occurrence assignments for all existing occurrences
 * of the specified shift schedule. It should be called when a user registers
 * for a recurring shift schedule.
 *
 * The function intelligently assigns the user to the next available slot for each
 * timestamp. For example, if there are occurrences with slots 0, 1, 2 for a given
 * timestamp, it will assign the user to the slot with the fewest assignments.
 *
 * @param tx - The database transaction to use
 * @param shiftScheduleId - The ID of the shift schedule
 * @param userId - The ID of the user to assign
 * @throws Error if the shift schedule doesn't exist or if assignment creation fails
 */
export async function assignUserToScheduleOccurrences(
	tx: Transaction,
	shiftScheduleId: number,
	userId: number,
) {
	// Verify the shift schedule exists
	const [schedule] = await tx
		.select()
		.from(shiftSchedules)
		.where(eq(shiftSchedules.id, shiftScheduleId))
		.limit(1);

	if (!schedule) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: `Shift schedule with ID ${shiftScheduleId} not found`,
		});
	}

	// Get all occurrences for this schedule
	const occurrences = await tx
		.select()
		.from(shiftOccurrences)
		.where(eq(shiftOccurrences.shiftScheduleId, shiftScheduleId));

	if (occurrences.length === 0) {
		return;
	}

	// Get all existing assignments for these occurrences
	const occurrenceIds = occurrences.map((occ) => occ.id);
	const existingAssignments = await tx
		.select()
		.from(shiftOccurrenceAssignments)
		.where(
			inArray(shiftOccurrenceAssignments.shiftOccurrenceId, occurrenceIds),
		);

	// Group occurrences by timestamp to handle slots intelligently
	const occurrencesByTimestamp = new Map<string, typeof occurrences>();
	for (const occ of occurrences) {
		const tsKey = occ.timestamp.toISOString();
		if (!occurrencesByTimestamp.has(tsKey)) {
			occurrencesByTimestamp.set(tsKey, []);
		}
		occurrencesByTimestamp.get(tsKey)?.push(occ);
	}

	// Count existing assignments per occurrence
	const assignmentCounts = new Map<number, number>();
	for (const assignment of existingAssignments) {
		assignmentCounts.set(
			assignment.shiftOccurrenceId,
			(assignmentCounts.get(assignment.shiftOccurrenceId) || 0) + 1,
		);
	}

	// Check if user is already assigned to any occurrences
	const userAssignedOccurrenceIds = new Set(
		existingAssignments
			.filter((a) => a.userId === userId)
			.map((a) => a.shiftOccurrenceId),
	);

	// For each timestamp, assign user to the slot with fewest assignments
	const occurrencesToAssign: number[] = [];
	for (const [_timestamp, occs] of Array.from(
		occurrencesByTimestamp.entries(),
	)) {
		// Skip if user is already assigned to any slot for this timestamp
		if (
			occs.some((occ: (typeof occurrences)[0]) =>
				userAssignedOccurrenceIds.has(occ.id),
			)
		) {
			continue;
		}

		// Find the occurrence (slot) with the fewest assignments
		let bestOccurrence = occs[0];
		let minAssignments = assignmentCounts.get(bestOccurrence.id) || 0;

		for (const occ of occs) {
			const count = assignmentCounts.get(occ.id) || 0;
			if (count < minAssignments) {
				bestOccurrence = occ;
				minAssignments = count;
			}
		}

		occurrencesToAssign.push(bestOccurrence.id);
	}

	if (occurrencesToAssign.length === 0) {
		return;
	}

	// Create assignments for all selected occurrences
	const result = await tx
		.insert(shiftOccurrenceAssignments)
		.values(
			occurrencesToAssign.map((occurrenceId) => ({
				shiftOccurrenceId: occurrenceId,
				userId,
				status: "assigned" as const,
			})),
		)
		.returning();

	// Verify all assignments were created
	// If this fails, the entire transaction will be rolled back automatically
	if (result.length !== occurrencesToAssign.length) {
		throw new TRPCError({
			code: "INTERNAL_SERVER_ERROR",
			message: `Failed to assign user ${userId} to all occurrences of shift schedule ${shiftScheduleId}`,
		});
	}
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
 * @throws Error if the shift schedule doesn't exist
 */
export async function unassignUserFromScheduleOccurrences(
	tx: Transaction,
	shiftScheduleId: number,
	userId: number,
) {
	// Verify the shift schedule exists
	const [schedule] = await tx
		.select()
		.from(shiftSchedules)
		.where(eq(shiftSchedules.id, shiftScheduleId))
		.limit(1);

	if (!schedule) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: `Shift schedule with ID ${shiftScheduleId} not found`,
		});
	}

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
 * @throws Error if the shift schedule doesn't exist or if any assignment fails
 */
export async function regenerateScheduleOccurrenceAssignments(
	tx: Transaction,
	shiftScheduleId: number,
) {
	// Verify the shift schedule exists
	const [schedule] = await tx
		.select()
		.from(shiftSchedules)
		.where(eq(shiftSchedules.id, shiftScheduleId))
		.limit(1);

	if (!schedule) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: `Shift schedule with ID ${shiftScheduleId} not found`,
		});
	}

	// Get all users assigned to this schedule
	const scheduleAssignments = await tx
		.select()
		.from(shiftScheduleAssignments)
		.where(eq(shiftScheduleAssignments.shiftScheduleId, shiftScheduleId));

	// For each assigned user, ensure they're assigned to all occurrences
	for (const assignment of scheduleAssignments) {
		try {
			await assignUserToScheduleOccurrences(
				tx,
				shiftScheduleId,
				assignment.userId,
			);
		} catch (error) {
			throw new TRPCError({
				code: "INTERNAL_SERVER_ERROR",
				message: `Failed to assign user ${assignment.userId} to occurrences of shift schedule ${shiftScheduleId}`,
			});
		}
	}
}
