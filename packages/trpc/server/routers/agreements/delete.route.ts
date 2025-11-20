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

	try {
		await prisma.agreement.delete({
			where: { id },
		});

		return { success: true };
	} catch (error) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Agreement not found",
			cause: error,
		});
	}
}
