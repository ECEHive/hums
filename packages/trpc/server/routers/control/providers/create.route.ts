/**
 * Control Provider Routes - Create
 */

import { createControlProvider } from "@ecehive/features";
import { z } from "zod";

export const ZCreateProviderSchema = z.object({
	name: z.string().min(1).max(255),
	providerType: z.enum(["GEORGIA_TECH_PLC"]),
	config: z.record(z.string(), z.unknown()),
	isActive: z.boolean().optional(),
});

export async function createProviderHandler({
	input,
}: {
	input: z.infer<typeof ZCreateProviderSchema>;
}) {
	return createControlProvider(input);
}
