/**
 * Control Gateway Routes - Get
 */

import { getControlGatewayById } from "@ecehive/features";
import { z } from "zod";

export const ZGetGatewaySchema = z.object({
	id: z.number().int(),
});

export async function getGatewayHandler({
	input,
}: {
	input: z.infer<typeof ZGetGatewaySchema>;
}) {
	return getControlGatewayById(input.id);
}
