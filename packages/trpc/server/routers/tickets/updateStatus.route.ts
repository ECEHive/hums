import { queueEmail } from "@ecehive/email";
import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { TProtectedProcedureContext } from "../../trpc";
import { TicketStatusEnum } from "./schemas";

export const ZUpdateTicketStatusSchema = z.object({
	id: z.string().uuid(),
	status: TicketStatusEnum,
	notes: z.string().max(2000).optional(),
});

export async function updateTicketStatusHandler({
	ctx,
	input,
}: {
	ctx: TProtectedProcedureContext;
	input: z.infer<typeof ZUpdateTicketStatusSchema>;
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

	const previousStatus = ticket.status;

	// Update ticket
	const updatedTicket = await prisma.ticket.update({
		where: { id: input.id },
		data: {
			status: input.status,
			resolvedAt: input.status === "resolved" ? new Date() : undefined,
			statusHistory: {
				create: {
					previousStatus,
					newStatus: input.status,
					notes: input.notes,
					changedById: ctx.user.id,
				},
			},
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

	// Send status update email to submitter if they have an email
	const submitterEmail = ticket.submitter?.email ?? ticket.submitterEmail;
	if (submitterEmail) {
		queueEmail({
			to: submitterEmail,
			template: "ticket-status-update",
			data: {
				ticketId: ticket.id,
				ticketTypeName: ticket.ticketType.name,
				submitterName:
					ticket.submitter?.name ?? ticket.submitterName ?? "there",
				previousStatus,
				newStatus: input.status,
				notes: input.notes,
				updatedAt: new Date(),
			},
		});
	}

	return updatedTicket;
}
