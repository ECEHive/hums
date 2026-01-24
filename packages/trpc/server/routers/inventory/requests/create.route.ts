import { prisma } from "@ecehive/prisma";
import z from "zod";
import type { TProtectedProcedureContext } from "../../../trpc";

export const ZCreateSchema = z
	.object({
		itemId: z.string().uuid().optional(),
		requestedItemName: z.string().min(1).max(255).optional(),
		quantity: z.number().int().positive(),
		reason: z.string().max(1000).optional(),
	})
	.refine((data) => data.itemId || data.requestedItemName, {
		message: "Either itemId or requestedItemName must be provided",
	});

export type TCreateSchema = z.infer<typeof ZCreateSchema>;

export type TCreateOptions = {
	ctx: TProtectedProcedureContext;
	input: TCreateSchema;
};

export async function createHandler(options: TCreateOptions) {
	const userId = options.ctx.user.id;
	const { itemId, requestedItemName, quantity, reason } = options.input;

	const request = await prisma.itemRequest.create({
		data: {
			itemId,
			requestedItemName,
			quantity,
			reason,
			requestedById: userId,
		},
		include: {
			item: {
				select: {
					id: true,
					name: true,
					sku: true,
				},
			},
			requestedBy: {
				select: {
					id: true,
					name: true,
					username: true,
				},
			},
		},
	});

	return request;
}
