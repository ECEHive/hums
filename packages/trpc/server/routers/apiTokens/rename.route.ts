import { renameApiToken } from "@ecehive/features";
import z from "zod";

export const ZRenameSchema = z.object({
	id: z.number().int().positive(),
	name: z.string().trim().min(1).max(100),
});

export type TRenameSchema = z.infer<typeof ZRenameSchema>;

export async function renameHandler(options: { input: TRenameSchema }) {
	await renameApiToken(options.input.id, options.input.name);
	return { success: true };
}
