/**
 * Control Gateway Routes - Create
 */

import { createControlGateway } from "@ecehive/features";
import { z } from "zod";

export const ZCreateGatewaySchema = z.object({
	name: z.string().min(1).max(255),
	description: z.string().max(1000).optional(),
	isActive: z.boolean().optional(),
	actions: z
		.array(
			z.object({
				controlPointId: z.string().uuid(),
				action: z.enum(["TURN_ON", "TURN_OFF", "UNLOCK"]),
			}),
		)
		.default([]),
});

export async function createGatewayHandler({
	input,
}: {
	input: z.infer<typeof ZCreateGatewaySchema>;
}) {
	return createControlGateway(input);
}
