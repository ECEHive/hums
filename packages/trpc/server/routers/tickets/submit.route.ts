import { queueEmail } from "@ecehive/email";
import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { Context } from "../../context";
import { TicketFieldsSchema, validateTicketDataDynamic } from "./schemas";

export const ZSubmitTicketSchema = z.object({
	ticketTypeId: z.number().int(),
	data: z.record(z.string(), z.unknown()),
	// For anonymous submissions
	submitterEmail: z.string().email().optional(),
	submitterName: z.string().max(200).optional(),
});

export async function submitTicketHandler({
	ctx,
	input,
}: {
	ctx: Context;
	input: z.infer<typeof ZSubmitTicketSchema>;
}) {
	// Get the ticket type
	const ticketType = await prisma.ticketType.findUnique({
		where: { id: input.ticketTypeId },
	});

	if (!ticketType) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Ticket type not found",
		});
	}

	if (!ticketType.isActive) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "This ticket type is no longer accepting submissions",
		});
	}

	// Check authentication requirement
	if (ticketType.requiresAuth && !ctx.userId) {
		throw new TRPCError({
			code: "UNAUTHORIZED",
			message: "This ticket type requires authentication",
		});
	}

	// Parse and validate the field schema from the ticket type
	let fieldSchema = null;
	if (ticketType.fieldSchema && typeof ticketType.fieldSchema === "object") {
		const parseResult = TicketFieldsSchema.safeParse(ticketType.fieldSchema);
		if (parseResult.success) {
			fieldSchema = parseResult.data;
		}
	}

	// Validate the ticket data against the dynamic schema
	const validation = validateTicketDataDynamic(fieldSchema, input.data);
	if (!validation.success) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: `Invalid ticket data: ${validation.error}`,
		});
	}

	// Get user info if authenticated
	let submitter = null;
	if (ctx.userId) {
		submitter = await prisma.user.findUnique({
			where: { id: ctx.userId },
		});
	}

	// Create the ticket
	const ticket = await prisma.ticket.create({
		data: {
			ticketTypeId: input.ticketTypeId,
			data: validation.data as object,
			submitterId: ctx.userId ?? null,
			submitterEmail: submitter?.email ?? input.submitterEmail ?? null,
			submitterName: submitter?.name ?? input.submitterName ?? null,
			status: "pending",
			statusHistory: {
				create: {
					previousStatus: null,
					newStatus: "pending",
					notes: "Ticket submitted",
					changedById: ctx.userId ?? null,
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
		},
	});

	// Send confirmation email if we have an email address
	const recipientEmail = submitter?.email ?? input.submitterEmail;
	if (recipientEmail) {
		queueEmail({
			to: recipientEmail,
			template: "ticket-confirmation",
			data: {
				ticketId: ticket.id,
				ticketTypeName: ticketType.name,
				ticketTypeDescription: ticketType.description,
				submitterName: submitter?.name ?? input.submitterName ?? "there",
				ticketData: validation.data as Record<string, unknown>,
				submittedAt: ticket.createdAt,
			},
		});
	}

	return {
		id: ticket.id,
		ticketType: ticket.ticketType,
		status: ticket.status,
		createdAt: ticket.createdAt,
	};
}
