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
 * Callers load and lock the schedule first, so it isn't looked up again here.
 *
 * @throws Error if assignment creation fails
 */
export async function assignUserToScheduleOccurrences(
	tx: Transaction,
	shiftScheduleId: number,
	userId: number,
) {
	// Users are counted here rather than with _count, which Prisma turns into a
	// GROUP BY over every occurrence assignment in the database
	const occurrences = await tx.shiftOccurrence.findMany({
		where: { shiftScheduleId },
		select: { id: true, timestamp: true, users: { select: { id: true } } },
		orderBy: { id: "asc" },
	});

	// For each week, pick the slot with the fewest users, skipping weeks the
	// user already has. Ties go to the lowest id.
	const takenWeeks = new Set(
		occurrences
			.filter((occ) => occ.users.some((u) => u.id === userId))
			.map((occ) => occ.timestamp.getTime()),
	);
	const best = new Map<number, { id: number; users: number }>();
	for (const occ of occurrences) {
		const week = occ.timestamp.getTime();
		if (takenWeeks.has(week)) continue;
		const current = best.get(week);
		if (!current || occ.users.length < current.users) {
			best.set(week, { id: occ.id, users: occ.users.length });
		}
	}

	if (best.size === 0) {
		return;
	}

	// One connect instead of one update per week; this runs under the schedule lock
	await tx.user.update({
		where: { id: userId },
		data: {
			shiftOccurrences: {
				connect: Array.from(best.values(), ({ id }) => ({ id })),
			},
		},
		select: { id: true },
	});
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
	const occurrences = await tx.shiftOccurrence.findMany({
		where: { shiftScheduleId, users: { some: { id: userId } } },
		select: { id: true },
	});

	if (occurrences.length === 0) {
		return;
	}

	await tx.user.update({
		where: { id: userId },
		data: {
			shiftOccurrences: {
				disconnect: occurrences.map(({ id }) => ({ id })),
			},
		},
		select: { id: true },
	});
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
