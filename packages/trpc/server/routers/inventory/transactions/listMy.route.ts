import { type Prisma, prisma } from "@ecehive/prisma";
import z from "zod";
import type { TProtectedProcedureContext } from "../../../trpc";

export const ZListMySchema = z.object({
	limit: z.number().min(1).max(100).optional(),
	offset: z.number().min(0).optional(),
});

export type TListMySchema = z.infer<typeof ZListMySchema>;

export type TListMyOptions = {
	ctx: TProtectedProcedureContext;
	input: TListMySchema;
};

export async function listMyHandler(options: TListMyOptions) {
	const { limit = 50, offset = 0 } = options.input;
	const userId = options.ctx.user.id;

	const where: Prisma.InventoryTransactionWhereInput = { userId };

	const [transactions, count] = await Promise.all([
		prisma.inventoryTransaction.findMany({
			where,
			orderBy: { createdAt: "desc" },
			skip: offset,
			take: limit,
			include: {
				item: { select: { id: true, name: true, sku: true } },
			},
		}),
		prisma.inventoryTransaction.count({ where }),
	]);

	return { transactions, count };
}
