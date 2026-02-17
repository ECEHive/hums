import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZDeleteSchema = z.object({
	id: z.number().min(1),
	userId: z.number().min(1).optional(), // Optional: if provided, verify ownership
});

export type TDeleteSchema = z.infer<typeof ZDeleteSchema>;

export type TDeleteOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TDeleteSchema;
};

export async function deleteHandler(options: TDeleteOptions) {
	const { id, userId } = options.input;

	const credential = await prisma.credential.findUnique({ where: { id } });

	if (!credential) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Credential not found",
		});
	}

	// If userId is provided, verify the credential belongs to that user
	if (userId !== undefined && credential.userId !== userId) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "Credential belongs to a different user",
		});
	}

	await prisma.credential.delete({ where: { id } });

	return { success: true };
}
