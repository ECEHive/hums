import { readControlPointState } from "@ecehive/features";
import { z } from "zod";

export const ZReadStateSchema = z.object({
	id: z.string().uuid(),
});

export async function readStateHandler({
	input,
}: {
	input: z.infer<typeof ZReadStateSchema>;
}) {
	return readControlPointState(input.id);
}
