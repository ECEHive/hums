import { getControlPoint } from "@ecehive/features";
import { z } from "zod";

export const ZGetPointSchema = z.object({
	id: z.string().uuid(),
});

export async function getPointHandler({
	input,
}: {
	input: z.infer<typeof ZGetPointSchema>;
}) {
	return getControlPoint(input.id);
}
