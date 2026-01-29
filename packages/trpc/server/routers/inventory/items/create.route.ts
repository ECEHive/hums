import { prisma } from "@ecehive/prisma";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../../trpc";

export const ZCreateItemSchema = z.object({
	name: z.string().min(1).max(255),
	description: z.string().max(1000).optional(),
	sku: z.string().max(100).optional(),
	location: z.string().max(255).optional(),
	minQuantity: z.number().int().min(0).optional(),
	link: z.string().url().optional().or(z.literal("")),
	isActive: z.boolean().optional(),
	initialQuantity: z.number().int().min(0).optional(),
	approvalRoleIds: z.array(z.number().int()).optional(),
});

export type TCreateItemSchema = z.infer<typeof ZCreateItemSchema>;

export type TCreateItemOptions = {
	ctx: TPermissionProtectedProcedureContext;
	input: TCreateItemSchema;
};

export async function createItemHandler(options: TCreateItemOptions) {
	const { initialQuantity, approvalRoleIds, ...itemData } = options.input;

	const item = await prisma.$transaction(async (tx) => {
		const newItem = await tx.item.create({
			data: {
				...itemData,
				approvalRoles: approvalRoleIds?.length
					? { connect: approvalRoleIds.map((id) => ({ id })) }
					: undefined,
			},
		});

		// Create initial snapshot if quantity provided
		if (initialQuantity !== undefined) {
			await tx.inventorySnapshot.create({
				data: {
					itemId: newItem.id,
					quantity: initialQuantity,
				},
			});
		}

		return tx.item.findUnique({
			where: { id: newItem.id },
			include: {
				snapshot: true,
				approvalRoles: {
					select: { id: true, name: true },
				},
			},
		});
	});

	return item;
}
