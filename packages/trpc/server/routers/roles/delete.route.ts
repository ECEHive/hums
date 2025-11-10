import { prisma } from "@ecehive/prisma";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZDeleteSchema = z.object({ id: z.number().min(1) });
export type TDeleteSchema = z.infer<typeof ZDeleteSchema>;

export type TDeleteOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TDeleteSchema;
};

export async function deleteHandler(options: TDeleteOptions) {
	const { id } = options.input;

	await prisma.role.delete({ where: { id } });

	return { success: true };
}
