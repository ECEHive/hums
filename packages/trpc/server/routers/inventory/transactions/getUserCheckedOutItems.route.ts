import { prisma } from "@ecehive/prisma";
import z from "zod";
import type { TInventoryProtectedProcedureContext } from "../../../trpc";

export const ZGetUserCheckedOutItemsSchema = z.object({
	userId: z.number().int(),
});

export type TGetUserCheckedOutItemsSchema = z.infer<
	typeof ZGetUserCheckedOutItemsSchema
>;

export type TGetUserCheckedOutItemsOptions = {
	ctx: TInventoryProtectedProcedureContext;
	input: TGetUserCheckedOutItemsSchema;
};

type CheckedOutItem = {
	id: string;
	name: string;
	sku: string;
	quantity: number;
	itemType: "multiple" | "single";
};

/**
 * Gets the checked out items for a user.
 */
export async function getUserCheckedOutItemsHandler(
	options: TGetUserCheckedOutItemsOptions,
) {
	const { userId } = options.input;

	// Use aggregate query to efficiently check if any (non-consumable) item has
	// negative balance.
	//
	// This lets the DB do the work instead of loading all transactions into
	// memory.
	const result = await prisma.$queryRaw<CheckedOutItem[]>`
			SELECT it."itemId", i."name", i."sku", SUM(it.quantity) as quantity, i."itemType"
			FROM "InventoryTransaction" it
			INNER JOIN "Item" i ON it."itemId" = i.id
			WHERE it."userId" = ${userId}
			AND i."itemType" <> 'consumable'
			GROUP BY it."itemId", i."name", i."sku", i."itemType"
			HAVING SUM(it.quantity) < 0
	`;

	return { checkedOutItems: result };
}
