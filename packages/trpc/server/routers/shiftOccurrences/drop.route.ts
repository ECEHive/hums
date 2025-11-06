import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZDropSchema = z.object({
	shiftOccurrenceId: z.number().min(1),
});

export type TDropSchema = z.infer<typeof ZDropSchema>;

export type TDropOptions = {
	ctx: TPermissionProtectedProcedureContext;
	input: TDropSchema;
};

export async function dropHandler(options: TDropOptions) {
	const { shiftOccurrenceId } = options.input;
	const userId = options.ctx.userId;

	if (!userId) {
		throw new Error("User not authenticated");
	}

	// Verify the shift occurrence exists
	const occurrence = await prisma.shiftOccurrence.findUnique({
		where: { id: shiftOccurrenceId },
		include: {
			users: true,
		},
	});

	if (!occurrence) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Shift occurrence not found",
		});
	}

	// Check if user is assigned
	if (!occurrence.users.some((u) => u.id === userId)) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "You are not assigned to this shift occurrence",
		});
	}

	// Unassign user from the occurrence
	await prisma.shiftOccurrence.update({
		where: { id: shiftOccurrenceId },
		data: {
			users: {
				disconnect: { id: userId },
			},
		},
	});

	return { success: true };
}
