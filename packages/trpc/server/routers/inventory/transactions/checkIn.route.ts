import { Prisma, prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import z from "zod";
import type { TInventoryProtectedProcedureContext } from "../../../trpc";

// Accept a userId and multiple items in a single check-in request
export const ZCheckInSchema = z.object({
	userId: z.number().int(),
	items: z.array(
		z.object({
			itemId: z.string().uuid(),
			quantity: z.number().int().positive(),
			notes: z.string().max(500).optional(),
		}),
	),
	// Optional approver ID for restricted items
	approverId: z.number().int().optional(),
});

export type TCheckInSchema = z.infer<typeof ZCheckInSchema>;

export type TCheckInOptions = {
	ctx: TInventoryProtectedProcedureContext;
	input: TCheckInSchema;
};

export async function checkInHandler(options: TCheckInOptions) {
	const { userId, items, approverId } = options.input;

	if (!Array.isArray(items) || items.length === 0) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "No items provided for check in",
		});
	}

	// Validate user exists
	const user = await prisma.user.findUnique({ where: { id: userId } });
	if (!user) {
		throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
	}

	const itemIds = items.map((i) => i.itemId);

	// Fetch all items up front with their approval roles
	const foundItems = await prisma.item.findMany({
		where: { id: { in: itemIds } },
		include: {
			approvalRoles: {
				select: { id: true, name: true },
			},
		},
	});

	// Ensure every requested item exists
	const foundIds = new Set(foundItems.map((i) => i.id));
	for (const requested of items) {
		if (!foundIds.has(requested.itemId)) {
			throw new TRPCError({
				code: "NOT_FOUND",
				message: `Item not found: ${requested.itemId}`,
			});
		}
	}

	// Ensure all items are active
	const inactive = foundItems.find((i) => !i.isActive);
	if (inactive) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: `Cannot check in to inactive item: ${inactive.id}`,
		});
	}

	// For single items, override the userId with the person who actually has it checked out
	// This allows anyone to return a single item on behalf of the original borrower
	const singleItems = foundItems.filter((i) => i.itemType === "single");
	const userIdOverrides = new Map<string, number>();

	if (singleItems.length > 0) {
		// Enforce quantity of 1 for single items
		for (const singleItem of singleItems) {
			const requested = items.find((i) => i.itemId === singleItem.id);
			if (requested && requested.quantity !== 1) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: `"${singleItem.name}" is an individual item and can only be returned with a quantity of 1`,
				});
			}
		}

		// Find who has each single item checked out
		for (const singleItem of singleItems) {
			const borrower = await prisma.$queryRaw<
				Array<{ userId: number; netQuantity: bigint }>
			>`
				SELECT "userId", SUM(quantity)::bigint as "netQuantity"
				FROM "InventoryTransaction"
				WHERE "itemId" = ${singleItem.id}
				GROUP BY "userId"
				HAVING SUM(quantity) < 0
			`;

			if (borrower.length === 0) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: `"${singleItem.name}" is not currently checked out`,
				});
			}

			// Use the borrower's userId for the return transaction
			userIdOverrides.set(singleItem.id, borrower[0].userId);
		}
	}

	// Validate that the user has enough items checked out to return
	// Get the user's current balance for the requested items (only for non-single items)
	const nonSingleItems = items.filter((i) => !userIdOverrides.has(i.itemId));
	const nonSingleItemIds = nonSingleItems.map((i) => i.itemId);

	if (nonSingleItemIds.length > 0) {
		const userBalances = await prisma.$queryRaw<
			Array<{ itemId: string; netQuantity: bigint }>
		>`
			SELECT "itemId", SUM(quantity)::bigint as "netQuantity"
			FROM "InventoryTransaction"
			WHERE "userId" = ${userId} AND "itemId" IN (${Prisma.join(nonSingleItemIds)})
			GROUP BY "itemId"
		`;

		// Create a map of itemId to net quantity (negative means checked out)
		const balanceMap = new Map<string, number>(
			userBalances.map((b) => [b.itemId, Number(b.netQuantity)]),
		);

		// Check each non-single item to ensure the user has enough checked out to return
		for (const requested of nonSingleItems) {
			const currentBalance = balanceMap.get(requested.itemId) ?? 0;
			// currentBalance is negative when items are checked out (e.g., -5 means 5 items checked out)
			// The user can return at most Math.abs(currentBalance) items
			const checkedOutQuantity = Math.abs(Math.min(0, currentBalance));

			if (requested.quantity > checkedOutQuantity) {
				const item = foundItems.find((i) => i.id === requested.itemId);
				const itemName = item?.name ?? requested.itemId;

				if (checkedOutQuantity === 0) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: `You do not have any "${itemName}" checked out to return`,
					});
				}

				throw new TRPCError({
					code: "BAD_REQUEST",
					message: `Cannot return ${requested.quantity} of "${itemName}" — you only have ${checkedOutQuantity} checked out`,
				});
			}
		}
	}

	// Check for items that require approval
	const itemsRequiringApproval = foundItems.filter(
		(item) => item.approvalRoles.length > 0,
	);

	if (itemsRequiringApproval.length > 0) {
		if (!approverId) {
			throw new TRPCError({
				code: "FORBIDDEN",
				message: `Approval required for restricted items: ${itemsRequiringApproval.map((i) => i.name).join(", ")}`,
			});
		}

		// Verify the approver has the required roles
		const approver = await prisma.user.findUnique({
			where: { id: approverId },
			include: {
				roles: {
					select: { id: true },
				},
			},
		});

		if (!approver) {
			throw new TRPCError({
				code: "NOT_FOUND",
				message: "Approver not found",
			});
		}

		const approverRoleIds = new Set(approver.roles.map((r) => r.id));

		// Check each restricted item - approver must have at least one of the required roles
		for (const item of itemsRequiringApproval) {
			const hasApprovalRole = item.approvalRoles.some((role) =>
				approverRoleIds.has(role.id),
			);

			if (!hasApprovalRole) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: `Approver does not have required role to approve check-in for: ${item.name}`,
				});
			}
		}
	}

	// Create transactions in a single DB transaction
	// For single items, use the overridden userId (the original borrower)
	const created = await prisma.$transaction(
		items.map((it) =>
			prisma.inventoryTransaction.create({
				data: {
					itemId: it.itemId,
					userId: userIdOverrides.get(it.itemId) ?? userId,
					action: "CHECK_IN",
					quantity: it.quantity,
					notes: it.notes,
				},
				include: {
					item: true,
					user: {
						select: {
							id: true,
							name: true,
							username: true,
						},
					},
				},
			}),
		),
	);

	return created;
}
