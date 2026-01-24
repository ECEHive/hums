import { type Prisma, prisma } from "@ecehive/prisma";
import z from "zod";
import type { Context } from "../../../context";

export const ZListItemsSchema = z.object({
	limit: z.number().min(1).max(100).optional(),
	offset: z.number().min(0).optional(),
	search: z.string().min(1).max(100).optional(),
	isActive: z.boolean().optional(),
});

export type TListItemsSchema = z.infer<typeof ZListItemsSchema>;

export type TListItemsOptions = {
	ctx?: Context;
	input: TListItemsSchema;
};

export async function listItemsHandler(options: TListItemsOptions) {
	const { search, limit = 100, offset = 0, isActive } = options.input;

	const where: Prisma.ItemWhereInput = {
		...(isActive !== undefined && { isActive }),
		...(search && {
			OR: [
				{ name: { contains: search, mode: "insensitive" } },
				{ description: { contains: search, mode: "insensitive" } },
				{ sku: { contains: search, mode: "insensitive" } },
				{ location: { contains: search, mode: "insensitive" } },
			],
		}),
	};

	const [items, count] = await Promise.all([
		prisma.item.findMany({
			where,
			orderBy: { createdAt: "desc" },
			skip: offset,
			take: limit,
			include: {
				snapshot: true,
				_count: {
					select: {
						transactions: true,
						requests: true,
					},
				},
			},
		}),
		prisma.item.count({ where }),
	]);

	return {
		items,
		count,
	};
}
