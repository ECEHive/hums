/**
 * Control Provider Routes - Get
 */

import { getControlProviderById } from "@ecehive/features";
import { z } from "zod";

export const ZGetProviderSchema = z.object({
	id: z.number().int(),
});

export async function getProviderHandler({
	input,
}: {
	input: z.infer<typeof ZGetProviderSchema>;
}) {
	return getControlProviderById(input.id);
}
