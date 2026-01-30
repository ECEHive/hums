import { prisma } from "@ecehive/prisma";
import { z } from "zod";

export const ZListTicketTypesSchema = z.object({
	activeOnly: z.boolean().default(true),
});

export async function listTicketTypesHandler({
	input,
}: {
	input: z.infer<typeof ZListTicketTypesSchema>;
}) {
	return prisma.ticketType.findMany({
		where: input.activeOnly ? { isActive: true } : undefined,
		orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
	});
}
