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

	// If lowQuantity filter is enabled, we need a different approach
	// to ensure proper pagination
	if (lowQuantity) {
		return await listLowQuantityItems({
			search,
			limit,
			offset,
			isActive,
		});
	}

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

		return {
			items: itemsWithNetQuantity,
			count,
		};
	}

	// If no items have snapshots, just return items with null currentQuantity
	const itemsWithNetQuantity = items.map((item) => ({
		...item,
		currentQuantity: null,
	}));

	return {
		items: itemsWithNetQuantity,
		count,
	};
}

/**
 * Separate function to handle low quantity filtering with proper pagination.
 * This computes the low-quantity item IDs in the database first, then paginates.
 */
async function listLowQuantityItems(options: {
	search?: string;
	limit: number;
	offset: number;
	isActive?: boolean;
}) {
	const { search, limit, offset, isActive } = options;

	// Build parameterized search pattern for ILIKE
	const searchPattern = search ? `%${search}%` : null;

	// Use parameterized queries to prevent SQL injection
	// When search is provided, we filter; when isActive is defined, we filter by that too
	const lowQuantityItemsRaw = await prisma.$queryRaw<
		Array<{ id: string; currentQuantity: bigint }>
	>`
		SELECT 
			i.id,
			(s.quantity + COALESCE(
				(SELECT SUM(t.quantity) 
				 FROM "InventoryTransaction" t 
				 WHERE t."itemId" = i.id AND t."createdAt" > s."takenAt"),
				0
			)) as "currentQuantity"
		FROM "Item" i
		INNER JOIN "InventorySnapshot" s ON i.id = s."itemId"
		WHERE i."minQuantity" IS NOT NULL
			AND (${searchPattern}::text IS NULL OR (
				i.name ILIKE ${searchPattern}
				OR i.description ILIKE ${searchPattern}
				OR i.sku ILIKE ${searchPattern}
				OR i.location ILIKE ${searchPattern}
			))
			AND (${isActive}::boolean IS NULL OR i."isActive" = ${isActive})
		HAVING (s.quantity + COALESCE(
			(SELECT SUM(t.quantity) 
			 FROM "InventoryTransaction" t 
			 WHERE t."itemId" = i.id AND t."createdAt" > s."takenAt"),
			0
		)) < i."minQuantity"
		ORDER BY i."createdAt" DESC
	`;

	const totalCount = lowQuantityItemsRaw.length;

	// Apply pagination to the IDs
	const paginatedIds = lowQuantityItemsRaw
		.slice(offset, offset + limit)
		.map((row) => row.id);

	if (paginatedIds.length === 0) {
		return {
			items: [],
			count: totalCount,
		};
	}

	// Create a map of current quantities
	const currentQuantityMap = new Map<string, number>(
		lowQuantityItemsRaw.map((row) => [row.id, Number(row.currentQuantity)]),
	);

	// Fetch full item data for the paginated results
	const items = await prisma.item.findMany({
		where: { id: { in: paginatedIds } },
		orderBy: { createdAt: "desc" },
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

	// Add currentQuantity to each item
	const itemsWithQuantity = items.map((item) => ({
		...item,
		currentQuantity: currentQuantityMap.get(item.id) ?? null,
	}));

	return {
		items: itemsWithQuantity,
		count: totalCount,
	};
}
