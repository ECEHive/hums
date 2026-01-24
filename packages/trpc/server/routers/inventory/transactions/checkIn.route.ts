import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../../trpc";

export const ZCheckInSchema = z.object({
	itemId: z.string().uuid(),
	quantity: z.number().int().positive(),
	notes: z.string().max(500).optional(),
});

export type TCheckInSchema = z.infer<typeof ZCheckInSchema>;

export type TCheckInOptions = {
	ctx: TPermissionProtectedProcedureContext;
	input: TCheckInSchema;
};

export async function checkInHandler(options: TCheckInOptions) {
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
			message: "Cannot check in to inactive item",
		});
	}

	const transaction = await prisma.inventoryTransaction.create({
		data: {
			itemId,
			userId,
			action: "CHECK_IN",
			quantity,
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
