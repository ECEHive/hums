import { prisma } from "@ecehive/prisma";
import z from "zod";
import type { TProtectedProcedureContext } from "../../trpc";

export const ZGetProfileSchema = z.object({});
export type TGetProfileSchema = z.infer<typeof ZGetProfileSchema>;

export type TGetProfileOptions = {
	ctx: TProtectedProcedureContext;
	input: TGetProfileSchema;
};

/**
 * Get the current user's profile information
 */
export async function getProfileHandler(options: TGetProfileOptions) {
	const userId = options.ctx.user.id;

	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: {
			id: true,
			username: true,
			name: true,
			email: true,
			createdAt: true,
		},
	});

	return user;
}
