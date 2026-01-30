import { Prisma, prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { TicketFieldsSchema } from "../schemas";

export const ZCreateTicketTypeSchema = z.object({
	name: z
		.string()
		.min(1, "Name is required")
		.max(100, "Name must be 100 characters or less"),
	description: z.string().max(500).optional(),
	icon: z.string().max(50).optional(),
	color: z.string().max(20).optional(),
	requiresAuth: z.boolean().default(false),
	isActive: z.boolean().default(true),
	sortOrder: z.number().int().default(0),
	fieldSchema: TicketFieldsSchema.optional(),
});

export async function createTicketTypeHandler({
	input,
}: {
	input: z.infer<typeof ZCreateTicketTypeSchema>;
}) {
	// Validate field schema if provided
	if (input.fieldSchema) {
		// Check for duplicate field IDs
		const fieldIds = input.fieldSchema.fields.map((f) => f.id);
		const uniqueIds = new Set(fieldIds);
		if (uniqueIds.size !== fieldIds.length) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "Duplicate field IDs are not allowed",
			});
		}
	}

	return prisma.ticketType.create({
		data: {
			name: input.name,
			description: input.description,
			icon: input.icon,
			color: input.color,
			requiresAuth: input.requiresAuth,
			isActive: input.isActive,
			sortOrder: input.sortOrder,
			fieldSchema: input.fieldSchema
				? (input.fieldSchema as unknown as Prisma.InputJsonValue)
				: Prisma.JsonNull,
		},
	});
}
