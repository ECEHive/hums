/**
 * Control Gateway Routes - List
 */

import { listControlGateways } from "@ecehive/features";
import { z } from "zod";

export const ZListGatewaysSchema = z.object({
	search: z.string().optional(),
	isActive: z.boolean().optional(),
	limit: z.number().int().min(1).max(100).default(25),
	offset: z.number().int().min(0).default(0),
});

export async function listGatewaysHandler({
	input,
}: {
	input: z.infer<typeof ZListGatewaysSchema>;
}) {
	return listControlGateways(input);
}
