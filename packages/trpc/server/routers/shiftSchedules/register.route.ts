import { assignUserToScheduleOccurrences } from "@ecehive/features";
import { prisma } from "@ecehive/prisma";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZRegisterSchema = z.object({
	shiftScheduleId: z.number().min(1),
});

export type TRegisterSchema = z.infer<typeof ZRegisterSchema>;

export type TRegisterOptions = {
	ctx: TPermissionProtectedProcedureContext;
	input: TRegisterSchema;
};

export async function registerHandler(options: TRegisterOptions) {
	const { shiftScheduleId } = options.input;
	const userId = options.ctx.userId;

	await prisma.$transaction(async (tx) => {
		// Connect user to shift schedule
		await tx.shiftSchedule.update({
			where: { id: shiftScheduleId },
			data: {
				users: {
					connect: { id: userId },
				},
			},
		});

		// Assign user to all occurrences
		await assignUserToScheduleOccurrences(tx, shiftScheduleId, userId);
	});

	return { success: true };
}
