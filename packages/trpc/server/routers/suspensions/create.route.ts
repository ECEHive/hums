import { createSuspension } from "@ecehive/features";
import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZCreateSchema = z.object({
	userId: z.number(),
	startDate: z.date(),
	endDate: z.date(),
	internalNotes: z.string().optional().nullable(),
	externalNotes: z.string().optional().nullable(),
});

export type TCreateSchema = z.infer<typeof ZCreateSchema>;

export type TCreateOptions = {
	ctx: TPermissionProtectedProcedureContext;
	input: TCreateSchema;
};

export async function createHandler(options: TCreateOptions) {
	const { userId, startDate, endDate, internalNotes, externalNotes } =
		options.input;

	// Validate that end date is after start date
	if (endDate <= startDate) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "End date must be after start date",
		});
	}

	// Verify user exists
	const user = await prisma.user.findUnique({
		where: { id: userId },
	});

	if (!user) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "User not found",
		});
	}

	const suspension = await createSuspension(prisma, {
		userId,
		startDate,
		endDate,
		internalNotes,
		externalNotes,
		createdById: options.ctx.user.id,
	});

	return suspension;
}
