import { Prisma } from "@ecehive/prisma";

export type SchedulingTransaction =
	| Prisma.TransactionClient
	| (Prisma.TransactionClient & Record<string, unknown>);

/**
 * Acquire a row-level lock on an InstantEventType to serialize booking creation.
 */
export async function lockInstantEventType(
	tx: SchedulingTransaction,
	instantEventTypeId: number,
) {
	const rows = await (tx as Prisma.TransactionClient).$queryRaw<
		{ id: number }[]
	>(
		Prisma.sql`
			SELECT "id"
			FROM "InstantEventType"
			WHERE "id" = ${instantEventTypeId}
			FOR UPDATE
		`,
	);

	return rows.length > 0;
}
