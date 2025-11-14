import type { PrismaClient } from "@ecehive/prisma";
import { Prisma } from "@ecehive/prisma";

export type TransactionLike = PrismaClient | Prisma.TransactionClient;

/**
 * Acquire a row-level lock on a shift schedule to serialize registration changes.
 *
 * @param tx - Prisma transaction/client
 * @param shiftScheduleId - Shift schedule to lock
 * @returns True when the schedule exists (and is locked)
 */
export async function lockShiftSchedule(
	tx: TransactionLike,
	shiftScheduleId: number,
) {
	const rows = await tx.$queryRaw<{ id: number }[]>(
		Prisma.sql`
			SELECT "id"
			FROM "ShiftSchedule"
			WHERE "id" = ${shiftScheduleId}
			FOR UPDATE
		`,
	);

	return rows.length > 0;
}

/**
 * Acquire deterministic row-level locks on one or more shift occurrences.
 *
 * @param tx - Prisma transaction/client
 * @param occurrenceIds - Occurrence IDs to lock
 * @returns Number of occurrences successfully locked
 */
export async function lockShiftOccurrences(
	tx: TransactionLike,
	occurrenceIds: number[],
) {
	const uniqueIds = Array.from(new Set(occurrenceIds)).filter((id) =>
		Number.isInteger(id),
	);

	if (uniqueIds.length === 0) {
		return 0;
	}

	const sortedIds = uniqueIds.sort((a, b) => a - b);

	const rows = await tx.$queryRaw<{ id: number }[]>(
		Prisma.sql`
			SELECT "id"
			FROM "ShiftOccurrence"
			WHERE "id" IN (${Prisma.join(sortedIds)})
			ORDER BY "id"
			FOR UPDATE
		`,
	);

	return rows.length;
}

/**
 * Convenience helper for a single occurrence.
 */
export async function lockShiftOccurrence(
	tx: TransactionLike,
	shiftOccurrenceId: number,
) {
	return lockShiftOccurrences(tx, [shiftOccurrenceId]);
}
