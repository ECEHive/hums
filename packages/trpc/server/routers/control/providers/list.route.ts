/**
 * Control Provider Routes - List
 */

import { listControlProviders } from "@ecehive/features";
import { z } from "zod";

export const ZListProvidersSchema = z.object({
	search: z.string().optional(),
	isActive: z.boolean().optional(),
	limit: z.number().int().min(1).max(100).default(25),
	offset: z.number().int().min(0).default(0),
});

export async function listProvidersHandler({
	input,
}: {
	input: z.infer<typeof ZListProvidersSchema>;
}) {
	return listControlProviders(input);
}
