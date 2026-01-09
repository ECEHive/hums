import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

// Username can not be changed
export const ZUpdateSchema = z.object({
	id: z.number().min(1),
	name: z.string().min(1).max(100),
	email: z.email(),
	slackUsername: z.string().nullable().optional(),
	roleIds: z.array(z.number().min(1)).optional(),
});

export type TUpdateSchema = z.infer<typeof ZUpdateSchema>;

export type TUpdateOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TUpdateSchema;
};

export async function updateHandler(options: TUpdateOptions) {
	const { id, name, email, slackUsername, roleIds } = options.input;

	const updated = await prisma.user.update({
		where: { id },
		data: {
			name,
			email,
			slackUsername: slackUsername === "" ? null : slackUsername,
			...(roleIds !== undefined
				? {
						roles: {
							set: roleIds.map((roleId) => ({ id: roleId })),
						},
					}
				: {}),
		},
		include: {
			roles: {
				orderBy: { name: "asc" },
			},
		},
	});

	if (!updated) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: `User with id ${id} not found`,
		});
	}

	return { user: updated };
}
