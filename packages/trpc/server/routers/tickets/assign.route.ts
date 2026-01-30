import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { TProtectedProcedureContext } from "../../trpc";

export const ZAssignTicketSchema = z.object({
	id: z.string().uuid(),
	handlerId: z.number().int().nullable(),
});

export async function assignTicketHandler({
	input,
}: {
	ctx: TProtectedProcedureContext;
	input: z.infer<typeof ZAssignTicketSchema>;
}) {
	const ticket = await prisma.ticket.findUnique({
		where: { id: input.id },
	});

	if (!ticket) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Ticket not found",
		});
	}

	// Verify the handler exists if provided
	if (input.handlerId) {
		const handler = await prisma.user.findUnique({
			where: { id: input.handlerId },
		});

		if (!handler) {
			throw new TRPCError({
				code: "NOT_FOUND",
				message: "Handler user not found",
			});
		}
	}

	return prisma.ticket.update({
		where: { id: input.id },
		data: {
			handlerId: input.handlerId,
		},
		include: {
			ticketType: true,
			submitter: {
				select: {
					id: true,
					name: true,
					email: true,
				},
			},
			handler: {
				select: {
					id: true,
					name: true,
					email: true,
				},
			},
		},
	});
}
