import { prisma } from "@ecehive/prisma";
import type { TPermissionProtectedProcedureContext } from "@ecehive/trpc/server";
import z from "zod";

export const ZGetSchema = z.object({
	id: z.number().min(1),
});

export type TGetSchema = z.infer<typeof ZGetSchema>;

export type TGetOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TGetSchema;
};

export async function getHandler(options: TGetOptions) {
	const { id } = options.input;

	const periodException = await prisma.periodException.findUnique({
		where: { id },
	});

	return { periodException };
}
