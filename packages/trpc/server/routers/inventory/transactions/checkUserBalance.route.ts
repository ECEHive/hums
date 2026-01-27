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

	// Get all transactions for this user
	const transactions = await prisma.inventoryTransaction.findMany({
		where: { userId },
		select: {
			itemId: true,
			quantity: true,
		},
	});

	// Calculate net balance per item
	// quantity is negative for CHECK_OUT and positive for CHECK_IN
	const itemBalances = new Map<string, number>();
	for (const transaction of transactions) {
		const currentBalance = itemBalances.get(transaction.itemId) || 0;
		itemBalances.set(transaction.itemId, currentBalance + transaction.quantity);
	}

	// If any item has a negative balance, user has items checked out
	const hasCheckedOutItems = Array.from(itemBalances.values()).some(
		(balance) => balance < 0,
	);

	return { hasCheckedOutItems };
}
