import { generateToken } from "@ecehive/auth";
import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZImpersonateSchema = z.object({
	userId: z.number(),
});

export type TImpersonateInput = z.infer<typeof ZImpersonateSchema>;

export async function impersonateHandler({
	input,
	ctx,
}: {
	input: TImpersonateInput;
	ctx?: TPermissionProtectedProcedureContext;
}) {
	if (!ctx) {
		throw new TRPCError({
			code: "INTERNAL_SERVER_ERROR",
			message: "Context is required",
		});
	}

	// Verify the target user exists
	const targetUser = await prisma.user.findUnique({
		where: { id: input.userId },
	});

	if (!targetUser) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "User not found",
		});
	}

	// Generate a token for the target user
	const token = await generateToken(input.userId, {
		impersonatedById: ctx.user.id ?? undefined,
	});

	if (!token) {
		throw new TRPCError({
			code: "INTERNAL_SERVER_ERROR",
			message: "Failed to generate token",
		});
	}

	return {
		token,
		user: {
			id: targetUser.id,
			name: targetUser.name,
			username: targetUser.username,
			email: targetUser.email,
		},
	};
}
