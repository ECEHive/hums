/**
 * Control Points Routes - Delete
 */

import { deleteControlPoint } from "@ecehive/features";
import { z } from "zod";

export const ZDeletePointSchema = z.object({
	id: z.string().uuid(),
});

export async function deletePointHandler({
	input,
}: {
	input: z.infer<typeof ZDeletePointSchema>;
}) {
	return deleteControlPoint(input.id);
}
