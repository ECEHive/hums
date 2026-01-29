import { prisma } from "@ecehive/prisma";
import z from "zod";
import type { TProtectedProcedureContext } from "../../../trpc";

export const ZGetMyNetBalanceSchema = z.object({
	search: z.string().min(1).max(100).optional(),
});

export type TGetMyNetBalanceSchema = z.infer<typeof ZGetMyNetBalanceSchema>;

export type TGetMyNetBalanceOptions = {
	ctx: TProtectedProcedureContext;
	input: TGetMyNetBalanceSchema;
};

export async function getMyNetBalanceHandler(options: TGetMyNetBalanceOptions) {
	const { search } = options.input;
	const userId = options.ctx.user.id;

	// Use raw SQL for efficient aggregation
	let result: Array<{
		itemId: string;
		itemName: string;
		itemSku: string | null;
		netQuantity: bigint;
	}>;

	if (search) {
		const searchPattern = `%${search}%`;
		result = await prisma.$queryRaw`
      SELECT 
        it."itemId",
        i.name as "itemName",
        i.sku as "itemSku",
        SUM(it.quantity)::bigint as "netQuantity"
      FROM "InventoryTransaction" it
      INNER JOIN "Item" i ON it."itemId" = i.id
      WHERE it."userId" = ${userId}
        AND (i.name ILIKE ${searchPattern} OR i.sku ILIKE ${searchPattern})
      GROUP BY it."itemId", i.name, i.sku
      HAVING SUM(it.quantity) != 0
      ORDER BY i.name ASC
    `;
	} else {
		result = await prisma.$queryRaw`
      SELECT 
        it."itemId",
        i.name as "itemName",
        i.sku as "itemSku",
        SUM(it.quantity)::bigint as "netQuantity"
      FROM "InventoryTransaction" it
      INNER JOIN "Item" i ON it."itemId" = i.id
      WHERE it."userId" = ${userId}
      GROUP BY it."itemId", i.name, i.sku
      HAVING SUM(it.quantity) != 0
      ORDER BY i.name ASC
    `;
	}

	// Convert bigint to number
	return result.map((item) => ({
		itemId: item.itemId,
		itemName: item.itemName,
		itemSku: item.itemSku,
		netQuantity: Number(item.netQuantity),
	}));
}
