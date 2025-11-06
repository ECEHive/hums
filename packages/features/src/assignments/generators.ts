import { TRPCError } from "@trpc/server";
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
	const schedule = await tx.shiftSchedule.findUnique({
		where: { id: shiftScheduleId },
	});

	if (!schedule) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: `Shift schedule with ID ${shiftScheduleId} not found`,
		});
	}

	// Get all occurrences for this schedule with their assigned users
	const occurrences = await tx.shiftOccurrence.findMany({
		where: { shiftScheduleId },
		include: {
			users: true,
		},
	});

	if (occurrences.length === 0) {
		return;
	}

	// Group occurrences by timestamp to handle slots intelligently
	const occurrencesByTimestamp = new Map<
		string,
		(typeof occurrences)[number][]
	>();
	for (const occ of occurrences) {
		const tsKey = occ.timestamp.toISOString();
		if (!occurrencesByTimestamp.has(tsKey)) {
			occurrencesByTimestamp.set(tsKey, []);
		}
		occurrencesByTimestamp.get(tsKey)?.push(occ);
	}

	// Check if user is already assigned to any occurrences
	const userAssignedOccurrenceIds = new Set(
		occurrences
			.filter((occ) => occ.users.some((u) => u.id === userId))
			.map((occ) => occ.id),
	);

	// For each timestamp, assign user to the slot with fewest assignments
	const occurrencesToAssign: number[] = [];
	for (const [_timestamp, occs] of Array.from(
		occurrencesByTimestamp.entries(),
	)) {
		// Skip if user is already assigned to any slot for this timestamp
		if (occs.some((occ) => userAssignedOccurrenceIds.has(occ.id))) {
			continue;
		}

		// Find the occurrence (slot) with the fewest assignments
		let bestOccurrence = occs[0];
		let minAssignments = bestOccurrence.users.length;

		for (const occ of occs) {
			const count = occ.users.length;
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

	// Create assignments for all selected occurrences using Prisma's implicit many-to-many
	for (const occurrenceId of occurrencesToAssign) {
		await tx.shiftOccurrence.update({
			where: { id: occurrenceId },
			data: {
				users: {
					connect: { id: userId },
				},
			},
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
	const schedule = await tx.shiftSchedule.findUnique({
		where: { id: shiftScheduleId },
	});

	if (!schedule) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: `Shift schedule with ID ${shiftScheduleId} not found`,
		});
	}

	// Get all occurrences for this schedule
	const occurrences = await tx.shiftOccurrence.findMany({
		where: { shiftScheduleId },
		select: { id: true },
	});

	if (occurrences.length === 0) {
		return;
	}

	// Disconnect user from all occurrences using Prisma's implicit many-to-many
	for (const occurrence of occurrences) {
		await tx.shiftOccurrence.update({
			where: { id: occurrence.id },
			data: {
				users: {
					disconnect: { id: userId },
				},
			},
		});
	}
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
	// Verify the shift schedule exists and get all assigned users
	const schedule = await tx.shiftSchedule.findUnique({
		where: { id: shiftScheduleId },
		include: {
			users: true,
		},
	});

	if (!schedule) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: `Shift schedule with ID ${shiftScheduleId} not found`,
		});
	}

	// For each assigned user, ensure they're assigned to all occurrences
	for (const user of schedule.users) {
		try {
			await assignUserToScheduleOccurrences(tx, shiftScheduleId, user.id);
		} catch {
			throw new TRPCError({
				code: "INTERNAL_SERVER_ERROR",
				message: `Failed to assign user ${user.id} to occurrences of shift schedule ${shiftScheduleId}`,
			});
		}
	}
}
