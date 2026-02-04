/**
 * Control Provider Routes - Update
 */

import { updateControlProvider } from "@ecehive/features";
import { z } from "zod";

export const ZUpdateProviderSchema = z.object({
	id: z.number().int(),
	name: z.string().min(1).max(255).optional(),
	config: z.record(z.string(), z.unknown()).optional(),
	isActive: z.boolean().optional(),
});

export async function updateProviderHandler({
	input,
}: {
	input: z.infer<typeof ZUpdateProviderSchema>;
}) {
	return updateControlProvider(input);
}
