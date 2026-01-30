import { queueEmail } from "@ecehive/email";
import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

export const ZAssignTicketSchema = z.object({
	id: z.string().uuid(),
	handlerId: z.number().int().nullable(),
});

export async function assignTicketHandler({
	input,
}: {
	input: z.infer<typeof ZAssignTicketSchema>;
}) {
	const ticket = await prisma.ticket.findUnique({
		where: { id: input.id },
		include: {
			ticketType: true,
			submitter: {
				select: {
					id: true,
					name: true,
					email: true,
				},
			},
		},
	});

	if (!ticket) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Ticket not found",
		});
	}

	// Verify the handler exists if provided
	let handler: {
		id: number;
		name: string | null;
		email: string | null;
	} | null = null;
	if (input.handlerId) {
		handler = await prisma.user.findUnique({
			where: { id: input.handlerId },
			select: {
				id: true,
				name: true,
				email: true,
			},
		});

		if (!handler) {
			throw new TRPCError({
				code: "NOT_FOUND",
				message: "Handler user not found",
			});
		}
	}

	const updatedTicket = await prisma.ticket.update({
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

	// Send assignment email to the new handler if they have an email
	if (handler?.email) {
		const submitterName =
			ticket.submitter?.name ?? ticket.submitterName ?? "Unknown";
		queueEmail({
			to: handler.email,
			template: "ticket-assignment",
			data: {
				ticketId: ticket.id,
				ticketTypeName: ticket.ticketType.name,
				submitterName,
				assigneeName: handler.name ?? "there",
				assignedAt: new Date(),
			},
		});
	}

	return updatedTicket;
}
