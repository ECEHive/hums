import { prisma } from "@ecehive/prisma";

import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

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
