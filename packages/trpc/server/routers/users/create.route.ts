import { db, users } from "@ecehive/drizzle";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZCreateSchema = z.object({
	username: z.string().min(1).max(100),
	name: z.string().min(1).max(100),
	email: z.string().email(),
	isSystemUser: z.boolean().optional().default(false),
});

export type TCreateSchema = z.infer<typeof ZCreateSchema>;

export type TCreateOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TCreateSchema;
};

export async function createHandler(options: TCreateOptions) {
	const { username, name, email, isSystemUser } = options.input;

	const [newUser] = await db
		.insert(users)
		.values({
			username,
			name,
			email,
			isSystemUser,
		})
		.returning();

	return { user: newUser };
}
