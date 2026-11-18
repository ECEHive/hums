/**
 * Control Gateway Routes - Regenerate access token
 */

import { regenerateControlGatewayToken } from "@ecehive/features";
import { z } from "zod";

export const ZRegenerateGatewayTokenSchema = z.object({
	id: z.number().int(),
});

export async function regenerateGatewayTokenHandler({
	input,
}: {
	input: z.infer<typeof ZRegenerateGatewayTokenSchema>;
}) {
	return regenerateControlGatewayToken(input.id);
}
