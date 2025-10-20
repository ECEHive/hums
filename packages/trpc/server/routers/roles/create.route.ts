import { db, roles } from "@ecehive/drizzle";
import { TRPCError } from "@trpc/server";
import type { DrizzleQueryError } from "drizzle-orm";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZCreateSchema = z.object({ name: z.string().min(1).max(200) });
export type TCreateSchema = z.infer<typeof ZCreateSchema>;

export type TCreateOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TCreateSchema;
};

type CreationError = { cause?: { code?: string } };

export async function createHandler(options: TCreateOptions) {
	const { name } = options.input;

	try {
		const inserted = await db.insert(roles).values({ name }).returning();
		return { role: inserted[0] };
	} catch (error) {
		if ((error as CreationError).cause?.code === "23505") {
			throw new TRPCError({
				code: "CONFLICT",
				message: `A role with the name "${name}" already exists.`,
			});
		}
		throw new TRPCError({
			code: "INTERNAL_SERVER_ERROR",
			message: "An unknown error occurred while creating the role.",
		});
	}
}
