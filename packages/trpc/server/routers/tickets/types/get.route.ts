import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

export const ZGetTicketTypeSchema = z.object({
	id: z.number().int().optional(),
	name: z.string().optional(),
});

export async function getTicketTypeHandler({
	input,
}: {
	input: z.infer<typeof ZGetTicketTypeSchema>;
}) {
	if (!input.id && !input.name) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Either id or name must be provided",
		});
	}

	const ticketType = await prisma.ticketType.findFirst({
		where: {
			...(input.id ? { id: input.id } : {}),
			...(input.name ? { name: input.name } : {}),
		},
	});

	if (!ticketType) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Ticket type not found",
		});
	}

	return ticketType;
}
