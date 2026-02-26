import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import z from "zod";
import type { Context } from "../../../context";

export const ZGetBySkuItemSchema = z.object({
	sku: z.string(),
});

export type TGetBySkuItemSchema = z.infer<typeof ZGetBySkuItemSchema>;
export type TGetBySkuItemOptions = {
	ctx?: Context;
	input: TGetBySkuItemSchema;
};

export async function getBySkuItemHandler(options: TGetBySkuItemOptions) {
	const { sku } = options.input;
	const item = await prisma.item.findUnique({
		where: { sku },
		include: {
			snapshot: true,
			approvalRoles: {
				select: { id: true, name: true },
			},
			_count: {
				select: {
					transactions: true,
				},
			},
		},
	});

	if (!item) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Item not found",
		});
	}

	// For single items, include whether the item is currently checked out
	if (item.itemType === "single") {
		const balanceResult = await prisma.$queryRaw<
			Array<{ netQuantity: bigint }>
		>`
			SELECT COALESCE(SUM(quantity), 0)::bigint as "netQuantity"
			FROM "InventoryTransaction"
			WHERE "itemId" = ${item.id}
		`;
		const netQuantity = Number(balanceResult[0]?.netQuantity ?? 0);
		return { ...item, isCheckedOut: netQuantity < 0 };
	}

	return { ...item, isCheckedOut: false };
}
