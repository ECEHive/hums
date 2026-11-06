import { Prisma, prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import z from "zod";
import type { TInventoryProtectedProcedureContext } from "../../../trpc";

// Accept a userId and multiple items in a single checkout request
export const ZCheckOutSchema = z.object({
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

export type TCheckOutSchema = z.infer<typeof ZCheckOutSchema>;

export type TCheckOutOptions = {
	ctx: TInventoryProtectedProcedureContext;
	input: TCheckOutSchema;
};

export async function checkOutHandler(options: TCheckOutOptions) {
	const { userId, items, approverId } = options.input;

	if (!Array.isArray(items) || items.length === 0) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "No items provided for checkout",
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
			message: `Cannot check out from inactive item: ${inactive.id}`,
		});
	}

	// Check transaction rate limit for each item
	// Fetch existing transactions for the user within the rate limit period
	for (const item of foundItems) {
		if (item.transactionRateLimit) {
			const rateLimitPeriod = item.transactionRateLimitPeriod || "day";
			const now = new Date();
			const startDate = new Date(now);
			switch (rateLimitPeriod) {
				case "day":
					startDate.setDate(now.getDate() - 1);
					break;
				case "week":
					startDate.setDate(now.getDate() - 7);
					break;
				case "month":
					startDate.setMonth(now.getDate() - 30);
					break;
				case "semester":
					startDate.setMonth(now.getDate() - 90);
					break;
			}

			const existingTransactions = await prisma.inventoryTransaction.findMany({
				where: {
					userId,
					itemId: item.id,
					createdAt: {
						gte: startDate,
						lte: now,
					},
				},
			});

			const totalCheckedOut = existingTransactions.reduce(
				(sum, tx) => sum + Math.abs(tx.quantity),
				0,
			);

			const quantity = items.find((i) => i.itemId === item.id)?.quantity;

			if (!quantity) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: `Quantity not provided for item: ${item.name}`,
				});
			}

			if (totalCheckedOut + quantity > item.transactionRateLimit) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: `Transaction rate limit exceeded for ${item.name}. Limit: ${item.transactionRateLimit} per ${item.transactionRateLimitPeriod}.`,
				});
			}
		}
	}

	// Validate single items: quantity must be 1. If someone else still has the
	// item checked out, it was physically returned but never recorded, so return
	// it on their behalf. If this user already has it, there's nothing to do.
	const singleItems = foundItems.filter((i) => i.itemType === "single");
	const autoReturns: Array<{
		itemId: string;
		userId: number;
		quantity: number;
	}> = [];
	const alreadyHeldItemIds = new Set<string>();
	if (singleItems.length > 0) {
		// Enforce quantity of 1 for single items
		for (const singleItem of singleItems) {
			const requested = items.find((i) => i.itemId === singleItem.id);
			if (requested && requested.quantity !== 1) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: `"${singleItem.name}" is an individual item and can only be checked out with a quantity of 1`,
				});
			}
		}

		// Find who currently has each single item checked out (net balance < 0)
		const singleItemIds = singleItems.map((i) => i.id);
		const holders = await prisma.$queryRaw<
			Array<{ itemId: string; userId: number; netQuantity: bigint }>
		>`
			SELECT "itemId", "userId", SUM(quantity)::bigint as "netQuantity"
			FROM "InventoryTransaction"
			WHERE "itemId" IN (${Prisma.join(singleItemIds)})
			GROUP BY "itemId", "userId"
			HAVING SUM(quantity) < 0
		`;

		for (const holder of holders) {
			if (holder.userId === userId) {
				alreadyHeldItemIds.add(holder.itemId);
			} else {
				autoReturns.push({
					itemId: holder.itemId,
					userId: holder.userId,
					quantity: -Number(holder.netQuantity),
				});
			}
		}
	}
	const itemsToCheckOut = items.filter(
		(it) => !alreadyHeldItemIds.has(it.itemId),
	);

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
					message: `Approver does not have required role to approve checkout for: ${item.name}`,
				});
			}
		}
	}

	// Check for in-space only items: user must have an active session
	const inSpaceOnlyItems = foundItems.filter((item) => item.inSpaceOnly);
	if (inSpaceOnlyItems.length > 0) {
		const activeSession = await prisma.session.findFirst({
			where: {
				userId,
				endedAt: null,
			},
		});

		if (!activeSession) {
			throw new TRPCError({
				code: "FORBIDDEN",
				message: `Cannot check out in-space only items without an active session. Items: ${inSpaceOnlyItems.map((i) => i.name).join(", ")}`,
			});
		}
	}

	// Create transactions in a single DB transaction
	const created = await prisma.$transaction([
		// Return unrecorded single items for their previous holders first
		...autoReturns.map((r) =>
			prisma.inventoryTransaction.create({
				data: {
					itemId: r.itemId,
					userId: r.userId,
					action: "CHECK_IN",
					quantity: r.quantity,
					notes: `Automatically returned: checked out by ${user.name} (${user.username})`,
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
		...itemsToCheckOut.map((it) =>
			prisma.inventoryTransaction.create({
				data: {
					itemId: it.itemId,
					userId,
					action: "CHECK_OUT",
					quantity: -it.quantity,
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
	]);

	// Only return this user's checkouts, not the automatic returns
	return created.slice(autoReturns.length);
}
