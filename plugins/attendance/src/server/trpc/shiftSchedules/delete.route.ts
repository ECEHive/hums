import { prisma } from "@ecehive/prisma";
import type { TPermissionProtectedProcedureContext } from "@ecehive/trpc/server";
import z from "zod";

export const ZDeleteSchema = z.object({ id: z.number().min(1) });
export type TDeleteSchema = z.infer<typeof ZDeleteSchema>;

export type TDeleteOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TDeleteSchema;
};

export async function deleteHandler(options: TDeleteOptions) {
	const { id } = options.input;

	const deleted = await prisma.shiftSchedule.delete({
		where: { id },
	});

	return { shiftSchedule: deleted };
}
