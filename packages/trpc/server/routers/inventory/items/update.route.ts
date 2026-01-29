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
	link: z.string().url().optional().or(z.literal("")),
	isActive: z.boolean().optional(),
	approvalRoleIds: z.array(z.number().int()).optional(),
});

export type TUpdateItemSchema = z.infer<typeof ZUpdateItemSchema>;

export type TUpdateItemOptions = {
	ctx: TPermissionProtectedProcedureContext;
	input: TUpdateItemSchema;
};

export async function updateItemHandler(options: TUpdateItemOptions) {
	const { id, approvalRoleIds, ...data } = options.input;

	// Build the update data with approval roles if provided
	const updateData: Parameters<typeof prisma.item.update>[0]["data"] = {
		...data,
	};

	// Only update approval roles if the field was explicitly provided
	if (approvalRoleIds !== undefined) {
		updateData.approvalRoles = {
			set: approvalRoleIds.map((roleId) => ({ id: roleId })),
		};
	}

	const item = await prisma.item.update({
		where: { id },
		data: updateData,
		include: {
			snapshot: true,
			approvalRoles: {
				select: { id: true, name: true },
			},
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
