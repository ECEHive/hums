import { prisma } from "@ecehive/prisma";
import { normalizeCardNumber } from "@ecehive/user-data";
import { TRPCError } from "@trpc/server";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZCreateSchema = z.object({
	userId: z.number().min(1),
	value: z.string().trim().min(1, "Credential value is required"),
});

export type TCreateSchema = z.infer<typeof ZCreateSchema>;

export type TCreateOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TCreateSchema;
};

export async function createHandler(options: TCreateOptions) {
	const { userId, value } = options.input;

	const normalized = normalizeCardNumber(value) ?? value.trim();

	const existing = await prisma.credential.findUnique({
		where: { value: normalized },
	});

	if (existing) {
		throw new TRPCError({
			code: "CONFLICT",
			message:
				existing.userId === userId
					? "This credential is already associated with this user"
					: "This credential is already associated with another user",
		});
	}

	const user = await prisma.user.findUnique({ where: { id: userId } });
	if (!user) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "User not found",
		});
	}

	const credential = await prisma.credential.create({
		data: { value: normalized, userId },
	});

	return { credential };
}
