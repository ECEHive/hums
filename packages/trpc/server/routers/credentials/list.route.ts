import { prisma } from "@ecehive/prisma";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZListSchema = z.object({
	userId: z.number().min(1),
});

export type TListSchema = z.infer<typeof ZListSchema>;

export type TListOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TListSchema;
};

export async function listHandler(options: TListOptions) {
	const { userId } = options.input;

	const credentials = await prisma.credential.findMany({
		where: { userId },
		orderBy: { createdAt: "desc" },
	});

	return { credentials };
}
