import { createUser } from "@ecehive/features";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZCreateSchema = z.object({
	username: z.string().min(1).max(100),
	name: z.string().max(100).optional(),
	email: z.union([z.email("Invalid email address"), z.literal("")]).optional(),
	slackUsername: z.string().nullable().optional(),
	roleIds: z.array(z.number().min(1)).optional(),
});

export type TCreateSchema = z.infer<typeof ZCreateSchema>;

export type TCreateOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TCreateSchema;
};

export async function createHandler(options: TCreateOptions) {
	const { username, name, email, slackUsername, roleIds } = options.input;

	const newUser = await createUser({
		username,
		name: name || undefined,
		email: email || undefined,
		slackUsername: slackUsername || undefined,
		roleIds,
		isSystemUser: false,
	});

	return { user: newUser };
}
