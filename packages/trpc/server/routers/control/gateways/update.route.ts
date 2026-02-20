/**
 * Control Gateway Routes - Update
 */

import { updateControlGateway } from "@ecehive/features";
import { z } from "zod";

export const ZUpdateGatewaySchema = z.object({
	id: z.number().int(),
	name: z.string().min(1).max(255).optional(),
	description: z.string().max(1000).nullish(),
	isActive: z.boolean().optional(),
	actions: z
		.array(
			z.object({
				controlPointId: z.string().uuid(),
				action: z.enum(["TURN_ON", "TURN_OFF", "UNLOCK"]),
			}),
		)
		.optional(),
});

export async function updateGatewayHandler({
	input,
}: {
	input: z.infer<typeof ZUpdateGatewaySchema>;
}) {
	return updateControlGateway(input);
}
