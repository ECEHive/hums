/**
 * Control Gateway Routes - Delete
 */

import { deleteControlGateway } from "@ecehive/features";
import { z } from "zod";

export const ZDeleteGatewaySchema = z.object({
	id: z.number().int(),
});

export async function deleteGatewayHandler({
	input,
}: {
	input: z.infer<typeof ZDeleteGatewaySchema>;
}) {
	return deleteControlGateway(input.id);
}
