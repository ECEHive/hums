import { prisma } from "@ecehive/prisma";
import { z } from "zod";

export const ZReorderTicketTypesSchema = z.object({
	/**
	 * Array of ticket type IDs in their new order.
	 * The sortOrder will be assigned based on array index.
	 */
	orderedIds: z.array(z.number().int()),
});

export async function reorderTicketTypesHandler({
	input,
}: {
	input: z.infer<typeof ZReorderTicketTypesSchema>;
}) {
	const { orderedIds } = input;

	// Update each ticket type's sortOrder based on its position in the array
	await prisma.$transaction(
		orderedIds.map((id, index) =>
			prisma.ticketType.update({
				where: { id },
				data: { sortOrder: index },
			}),
		),
	);

	return { success: true };
}
