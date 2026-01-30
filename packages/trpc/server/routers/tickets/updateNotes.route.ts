import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { TProtectedProcedureContext } from "../../trpc";

export const ZUpdateTicketNotesSchema = z.object({
	id: z.string().uuid(),
	internalNotes: z.string().max(5000).optional().nullable(),
	resolutionNotes: z.string().max(5000).optional().nullable(),
});

export async function updateTicketNotesHandler({
	input,
}: {
	ctx: TProtectedProcedureContext;
	input: z.infer<typeof ZUpdateTicketNotesSchema>;
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

	const updateData: {
		internalNotes?: string | null;
		resolutionNotes?: string | null;
	} = {};

	if (input.internalNotes !== undefined) {
		updateData.internalNotes = input.internalNotes;
	}

	if (input.resolutionNotes !== undefined) {
		updateData.resolutionNotes = input.resolutionNotes;
	}

	return prisma.ticket.update({
		where: { id: input.id },
		data: updateData,
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
