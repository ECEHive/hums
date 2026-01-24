import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../../trpc";

export const ZCheckOutSchema = z.object({
	itemId: z.string().uuid(),
	quantity: z.number().int().positive(),
	notes: z.string().max(500).optional(),
});

export type TCheckOutSchema = z.infer<typeof ZCheckOutSchema>;

export type TCheckOutOptions = {
	ctx: TPermissionProtectedProcedureContext;
	input: TCheckOutSchema;
};

export async function checkOutHandler(options: TCheckOutOptions) {
	const { itemId, quantity, notes } = options.input;
	const userId = options.ctx.user.id;

	// Verify item exists
	const item = await prisma.item.findUnique({
		where: { id: itemId },
	});

	if (!item) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Item not found",
		});
	}

	if (!item.isActive) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Cannot check out from inactive item",
		});
	}

	const transaction = await prisma.inventoryTransaction.create({
		data: {
			itemId,
			userId,
			action: "CHECK_OUT",
			quantity: -quantity, // Store as negative
			notes,
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
	});

	return transaction;
}
