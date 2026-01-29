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

	// Use aggregate query to efficiently check if any item has negative balance
	// This lets the DB do the work instead of loading all transactions into memory
	const result = await prisma.$queryRaw<Array<{ has_checked_out: boolean }>>`
		SELECT EXISTS (
			SELECT 1
			FROM (
				SELECT "itemId", SUM(quantity) as net_quantity
				FROM "InventoryTransaction"
				WHERE "userId" = ${userId}
				GROUP BY "itemId"
				HAVING SUM(quantity) < 0
			) AS items_with_negative_balance
		) AS has_checked_out
	`;

	const hasCheckedOutItems = result[0]?.has_checked_out ?? false;

	return { hasCheckedOutItems };
}
