import { Prisma, prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { TProtectedProcedureContext } from "../../../trpc";
import { TicketFieldsSchema } from "../schemas";

export const ZUpdateTicketTypeSchema = z.object({
	id: z.number().int(),
	name: z.string().min(1).max(100).optional(),
	description: z.string().max(500).optional().nullable(),
	icon: z.string().max(50).optional().nullable(),
	color: z.string().max(20).optional().nullable(),
	requiresAuth: z.boolean().optional(),
	isActive: z.boolean().optional(),
	sortOrder: z.number().int().optional(),
	fieldSchema: TicketFieldsSchema.optional().nullable(),
});

export async function updateTicketTypeHandler({
	input,
}: {
	ctx: TProtectedProcedureContext;
	input: z.infer<typeof ZUpdateTicketTypeSchema>;
}) {
	const { id, fieldSchema, ...rest } = input;

	// Validate field schema if provided
	if (fieldSchema) {
		// Check for duplicate field IDs
		const fieldIds = fieldSchema.fields.map((f) => f.id);
		const uniqueIds = new Set(fieldIds);
		if (uniqueIds.size !== fieldIds.length) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "Duplicate field IDs are not allowed",
			});
		}
	}

	return prisma.ticketType.update({
		where: { id },
		data: {
			...rest,
			...(fieldSchema !== undefined && {
				fieldSchema:
					fieldSchema === null
						? Prisma.JsonNull
						: (fieldSchema as unknown as Prisma.InputJsonValue),
			}),
		},
	});
}
