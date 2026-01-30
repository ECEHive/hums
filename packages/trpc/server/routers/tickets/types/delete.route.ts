import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

export const ZDeleteTicketTypeSchema = z.object({
	id: z.number().int(),
});

export async function deleteTicketTypeHandler({
	input,
}: {
	input: z.infer<typeof ZDeleteTicketTypeSchema>;
}) {
	// Check if there are any tickets using this type
	const ticketCount = await prisma.ticket.count({
		where: { ticketTypeId: input.id },
	});

	if (ticketCount > 0) {
		throw new TRPCError({
			code: "PRECONDITION_FAILED",
			message: `Cannot delete ticket type: ${ticketCount} ticket(s) are using this type. Consider deactivating it instead.`,
		});
	}

	return prisma.ticketType.delete({
		where: { id: input.id },
	});
}
