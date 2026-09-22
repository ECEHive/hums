import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZDeleteSchema = z.object({
	id: z.number().min(1),
});

export type TDeleteSchema = z.infer<typeof ZDeleteSchema>;

export type TDeleteOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TDeleteSchema;
};

export async function deleteHandler(options: TDeleteOptions) {
	const { id } = options.input;

	const webhookEndpoint = await prisma.webhookEndpoint.delete({
		where: { id },
	});

	if (!webhookEndpoint) {
		throw new TRPCError({
			code: "INTERNAL_SERVER_ERROR",
			message: "Failed to delete webhook endpoint",
		});
	}

	return { webhookEndpoint };
}
