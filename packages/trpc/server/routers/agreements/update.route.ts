import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZUpdateSchema = z.object({
	id: z.number().min(1),
	title: z.string().min(1).max(500).optional(),
	content: z.string().min(1).optional(),
	confirmationText: z.string().min(1).max(500).optional(),
	isEnabled: z.boolean().optional(),
});

export type TUpdateSchema = z.infer<typeof ZUpdateSchema>;

export type TUpdateOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TUpdateSchema;
};

export async function updateHandler(options: TUpdateOptions) {
	const { id, ...data } = options.input;

	try {
		const agreement = await prisma.agreement.update({
			where: { id },
			data,
		});

		return { agreement };
	} catch (error) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Agreement not found",
			cause: error,
		});
	}
}
