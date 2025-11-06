import { unassignUserFromScheduleOccurrences } from "@ecehive/features";
import { prisma } from "@ecehive/prisma";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZUnregisterSchema = z.object({
	shiftScheduleId: z.number().min(1),
});

export type TUnregisterSchema = z.infer<typeof ZUnregisterSchema>;

export type TUnregisterOptions = {
	ctx: TPermissionProtectedProcedureContext;
	input: TUnregisterSchema;
};

export async function unregisterHandler(options: TUnregisterOptions) {
	const { shiftScheduleId } = options.input;
	const userId = options.ctx.userId;

	if (!userId) {
		throw new Error("User not authenticated");
	}

	await prisma.$transaction(async (tx) => {
		// Unassign user from all occurrences
		await unassignUserFromScheduleOccurrences(tx, shiftScheduleId, userId);

		// Disconnect user from shift schedule
		await tx.shiftSchedule.update({
			where: { id: shiftScheduleId },
			data: {
				users: {
					disconnect: { id: userId },
				},
			},
		});
	});

	return { success: true };
}
