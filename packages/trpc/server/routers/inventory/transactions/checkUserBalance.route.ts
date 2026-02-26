import { prisma } from "@ecehive/prisma";
import z from "zod";
import type { TInventoryProtectedProcedureContext } from "../../../trpc";

export const ZCheckUserBalanceSchema = z.object({
	userId: z.number().int(),
});

export type TCheckUserBalanceSchema = z.infer<typeof ZCheckUserBalanceSchema>;

export type TCheckUserBalanceOptions = {
	ctx: TInventoryProtectedProcedureContext;
	input: TCheckUserBalanceSchema;
};

/**
 * Check if a user has any items checked out (net negative balance).
 * This is used by the kiosk to determine if the "Return Items" button should be shown.
 */
export async function checkUserBalanceHandler(
	options: TCheckUserBalanceOptions,
) {
	const { userId } = options.input;

	// Use aggregate query to efficiently check if any (non-consumable) item has
	// negative balance.
	//
	// This lets the DB do the work instead of loading all transactions into
	// memory.
	const result = await prisma.$queryRaw<Array<{ has_checked_out: boolean }>>`
		SELECT EXISTS (
			SELECT 1
			FROM (
				SELECT it."itemId", SUM(it.quantity) as net_quantity
				FROM "InventoryTransaction" it
				INNER JOIN "Item" i ON it."itemId" = i.id
				WHERE it."userId" = ${userId}
				  AND i."isConsumable" = FALSE
				GROUP BY it."itemId"
				HAVING SUM(it.quantity) < 0
			) AS items_with_negative_balance
		) AS has_checked_out
	`;

	const hasCheckedOutItems = result[0]?.has_checked_out ?? false;

	return { hasCheckedOutItems };
}
