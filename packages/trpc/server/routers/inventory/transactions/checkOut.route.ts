import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import z from "zod";
import type { TInventoryProtectedProcedureContext } from "../../../trpc";

// (removed single-array schema) - now accepts userId + items

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
});

export type TCheckOutSchema = z.infer<typeof ZCheckOutSchema>;

export type TCheckOutOptions = {
	ctx: TInventoryProtectedProcedureContext;
	input: TCheckOutSchema;
};

export async function checkOutHandler(options: TCheckOutOptions) {
	const { userId, items } = options.input;

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

	// Fetch all items up front
	const foundItems = await prisma.item.findMany({
		where: { id: { in: itemIds } },
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

	// Create transactions in a single DB transaction
	const created = await prisma.$transaction(
		items.map((it) =>
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
	);

	return created;
}
