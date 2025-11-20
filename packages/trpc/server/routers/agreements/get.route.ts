import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
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

	const agreement = await prisma.agreement.findUnique({
		where: { id },
		include: {
			userAgreements: {
				include: {
					user: {
						select: {
							id: true,
							name: true,
							username: true,
							email: true,
						},
					},
				},
			},
		},
	});

	if (!agreement) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Agreement not found",
		});
	}

	return { agreement };
}
