import { prisma } from "@ecehive/prisma";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZCreateSchema = z.object({
	username: z.string().min(1).max(100),
	name: z.string().min(1).max(100),
	email: z.email(),
	roleIds: z.array(z.number().min(1)).optional(),
});

export type TCreateSchema = z.infer<typeof ZCreateSchema>;

export type TCreateOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TCreateSchema;
};

export async function createHandler(options: TCreateOptions) {
	const { username, name, email, roleIds } = options.input;

	const newUser = await prisma.user.create({
		data: {
			username,
			name,
			email,
			// isSystemUser is always false for user-created accounts
			isSystemUser: false,
			...(roleIds && roleIds.length > 0
				? {
						roles: {
							connect: roleIds.map((id) => ({ id })),
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

	return { user: newUser };
}
