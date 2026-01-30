import { type Prisma, prisma } from "@ecehive/prisma";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../../trpc";

export const ZListSchema = z.object({
	itemId: z.string().uuid().optional(),
	userId: z.number().int().optional(),
	search: z.string().min(1).max(100).optional(),
	limit: z.number().min(1).max(100).optional(),
	offset: z.number().min(0).optional(),
});

export type TListSchema = z.infer<typeof ZListSchema>;

export type TListOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TListSchema;
};

export async function listHandler(options: TListOptions) {
	const { itemId, userId, search, limit = 50, offset = 0 } = options.input;

	const where: Prisma.InventoryTransactionWhereInput = {
		...(itemId && { itemId }),
		...(userId && { userId }),
		...(search && {
			OR: [
				{ item: { name: { contains: search, mode: "insensitive" } } },
				{ item: { sku: { contains: search, mode: "insensitive" } } },
				{ user: { name: { contains: search, mode: "insensitive" } } },
				{ user: { username: { contains: search, mode: "insensitive" } } },
				{ notes: { contains: search, mode: "insensitive" } },
			],
		}),
	};

	const [transactions, count] = await Promise.all([
		prisma.inventoryTransaction.findMany({
			where,
			orderBy: { createdAt: "desc" },
			skip: offset,
			take: limit,
			include: {
				item: {
					select: { id: true, name: true, sku: true },
				},
				user: {
					select: { id: true, name: true, username: true },
				},
			},
		}),
		prisma.inventoryTransaction.count({ where }),
	]);

	return { transactions, count };
}
