import { db, users } from "@ecehive/drizzle";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

// Username can not be changed
export const ZUpdateSchema = z.object({
	id: z.number().min(1),
	name: z.string().min(1).max(100),
	email: z.email(),
});

export type TUpdateSchema = z.infer<typeof ZUpdateSchema>;

export type TUpdateOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TUpdateSchema;
};

export async function updateHandler(options: TUpdateOptions) {
	const { id, name, email } = options.input;

	const [updated] = await db
		.update(users)
		.set({ name, email })
		.where(eq(users.id, id))
		.returning();

	if (!updated) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: `User with id ${id} not found`,
		});
	}

	return { user: updated };
}
