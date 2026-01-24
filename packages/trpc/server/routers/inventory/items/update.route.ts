import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../../trpc";

export const ZUpdateItemSchema = z.object({
	id: z.string().uuid(),
	name: z.string().min(1).max(255).optional(),
	description: z.string().max(1000).optional(),
	sku: z.string().max(100).optional(),
	location: z.string().max(255).optional(),
	minQuantity: z.number().int().min(0).optional(),
	isActive: z.boolean().optional(),
});

export type TUpdateItemSchema = z.infer<typeof ZUpdateItemSchema>;

export type TUpdateItemOptions = {
	ctx: TPermissionProtectedProcedureContext;
	input: TUpdateItemSchema;
};

export async function updateItemHandler(options: TUpdateItemOptions) {
	const { id, ...data } = options.input;

	const item = await prisma.item.update({
		where: { id },
		data,
		include: {
			snapshot: true,
		},
	});

	if (!item) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Item not found",
		});
	}

	return item;
}
