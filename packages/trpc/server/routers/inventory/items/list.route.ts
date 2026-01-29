import { type Prisma, prisma } from "@ecehive/prisma";
import z from "zod";
import type { Context } from "../../../context";

export const ZListItemsSchema = z.object({
	limit: z.number().min(1).max(100).optional(),
	offset: z.number().min(0).optional(),
	search: z.string().min(1).max(100).optional(),
	isActive: z.boolean().optional(),
	lowQuantity: z.boolean().optional(),
});

export type TListItemsSchema = z.infer<typeof ZListItemsSchema>;

export type TListItemsOptions = {
	ctx?: Context;
	input: TListItemsSchema;
};

export async function listItemsHandler(options: TListItemsOptions) {
	const {
		search,
		limit = 100,
		offset = 0,
		isActive,
		lowQuantity,
	} = options.input;

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
				approvalRoles: {
					select: { id: true, name: true },
				},
				_count: {
					select: {
						transactions: true,
					},
				},
			},
		}),
		prisma.item.count({ where }),
	]);

	// Get all transactions after snapshots for items that have snapshots
	const itemsWithSnapshots = items.filter((item) => item.snapshot);

	if (itemsWithSnapshots.length > 0) {
		// Use raw SQL to efficiently calculate net quantities
		// This query sums transactions only after each item's snapshot
		const netQuantitiesRaw = await prisma.$queryRaw<
			Array<{ itemId: string; netQuantity: bigint }>
		>`
			SELECT 
				t."itemId",
				COALESCE(SUM(t.quantity), 0) as "netQuantity"
			FROM "InventoryTransaction" t
			INNER JOIN "InventorySnapshot" s ON t."itemId" = s."itemId"
			WHERE t."itemId" = ANY(${itemsWithSnapshots.map((item) => item.id)})
				AND t."createdAt" > s."takenAt"
			GROUP BY t."itemId"
		`;

		// Convert bigint to number and create a map
		const netQuantities = new Map<string, number>(
			netQuantitiesRaw.map((row) => [row.itemId, Number(row.netQuantity)]),
		);

		// Add currentQuantity to each item
		const itemsWithNetQuantity = items.map((item) => {
			let currentQuantity = item.snapshot?.quantity ?? null;

			if (item.snapshot) {
				const netTransactionQuantity = netQuantities.get(item.id) ?? 0;
				currentQuantity = item.snapshot.quantity + netTransactionQuantity;
			}

			return {
				...item,
				currentQuantity,
			};
		});

		// Filter by low quantity if requested
		const filteredItems = lowQuantity
			? itemsWithNetQuantity.filter(
					(item) =>
						item.minQuantity !== null &&
						item.currentQuantity !== null &&
						item.currentQuantity < item.minQuantity,
				)
			: itemsWithNetQuantity;

		return {
			items: filteredItems,
			count: lowQuantity ? filteredItems.length : count,
		};
	}

	// If no items have snapshots, just return items with null currentQuantity
	const itemsWithNetQuantity = items.map((item) => ({
		...item,
		currentQuantity: null,
	}));

	// Filter by low quantity if requested (but items without snapshots will have null currentQuantity)
	const filteredItems = lowQuantity
		? itemsWithNetQuantity.filter(
				(item) =>
					item.minQuantity !== null &&
					item.currentQuantity !== null &&
					item.currentQuantity < item.minQuantity,
			)
		: itemsWithNetQuantity;

	return {
		items: filteredItems,
		count: lowQuantity ? filteredItems.length : count,
	};
}
