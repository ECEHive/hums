/**
 * Control Provider Routes - Delete
 */

import { deleteControlProvider } from "@ecehive/features";
import { z } from "zod";

export const ZDeleteProviderSchema = z.object({
	id: z.number().int(),
});

export async function deleteProviderHandler({
	input,
}: {
	input: z.infer<typeof ZDeleteProviderSchema>;
}) {
	return deleteControlProvider(input.id);
}
