import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { TProtectedProcedureContext } from "../../trpc";

export const ZGetTicketSchema = z.object({
	id: z.string().uuid(),
});

export async function getTicketHandler({
	input,
}: {
	ctx: TProtectedProcedureContext;
	input: z.infer<typeof ZGetTicketSchema>;
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
					username: true,
				},
			},
			handler: {
				select: {
					id: true,
					name: true,
					email: true,
					username: true,
				},
			},
			statusHistory: {
				include: {
					changedBy: {
						select: {
							id: true,
							name: true,
							email: true,
						},
					},
				},
				orderBy: { createdAt: "desc" },
			},
		},
	});

	if (!ticket) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Ticket not found",
		});
	}

	return ticket;
}

export const ZGetMyTicketSchema = z.object({
	id: z.string().uuid(),
});

export async function getMyTicketHandler({
	ctx,
	input,
}: {
	ctx: TProtectedProcedureContext;
	input: z.infer<typeof ZGetMyTicketSchema>;
}) {
	const ticket = await prisma.ticket.findFirst({
		where: {
			id: input.id,
			submitterId: ctx.user.id,
		},
		include: {
			ticketType: true,
			handler: {
				select: {
					id: true,
					name: true,
					email: true,
				},
			},
			statusHistory: {
				include: {
					changedBy: {
						select: {
							id: true,
							name: true,
						},
					},
				},
				orderBy: { createdAt: "desc" },
			},
		},
	});

	if (!ticket) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Ticket not found",
		});
	}

	return ticket;
}
