import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZCreateSchema = z.object({
	title: z.string().min(1).max(500),
	content: z.string().min(1),
	confirmationText: z.string().min(1).max(500),
	isEnabled: z.boolean().default(true),
});

export type TCreateSchema = z.infer<typeof ZCreateSchema>;

export type TCreateOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TCreateSchema;
};

export async function createHandler(options: TCreateOptions) {
	const { title, content, confirmationText, isEnabled } = options.input;

	try {
		const agreement = await prisma.agreement.create({
			data: {
				title,
				content,
				confirmationText,
				isEnabled,
			},
		});

		return { agreement };
	} catch (error) {
		throw new TRPCError({
			code: "INTERNAL_SERVER_ERROR",
			message: "Failed to create agreement",
			cause: error,
		});
	}
}
