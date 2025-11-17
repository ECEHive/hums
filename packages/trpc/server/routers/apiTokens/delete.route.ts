import { deleteApiToken } from "@ecehive/features";
import z from "zod";

export const ZDeleteSchema = z.object({
	id: z.number().int().positive(),
});

export type TDeleteSchema = z.infer<typeof ZDeleteSchema>;

export async function deleteHandler(options: { input: TDeleteSchema }) {
	await deleteApiToken(options.input.id);
	return { success: true };
}
