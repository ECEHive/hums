import {
	shiftScheduleEvents,
	unassignUserFromScheduleOccurrences,
} from "@ecehive/features";
import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
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

	let periodId = 0;

	await prisma.$transaction(async (tx) => {
		// Get the shift schedule to verify it exists and check canSelfAssign
		const targetSchedule = await tx.shiftSchedule.findUnique({
			where: { id: shiftScheduleId },
			include: {
				shiftType: true,
				users: { select: { id: true } },
			},
		});

		if (!targetSchedule) {
			throw new TRPCError({
				code: "NOT_FOUND",
				message: "Shift schedule not found",
			});
		}

		// Store periodId for event emission
		periodId = targetSchedule.shiftType.periodId;

		// Check if canSelfAssign is allowed
		if (!targetSchedule.shiftType.canSelfAssign) {
			throw new TRPCError({
				code: "FORBIDDEN",
				message:
					"Self-unregistration is not allowed for this shift type. An administrator must unassign you.",
			});
		}

		// Check if user is actually registered
		if (!targetSchedule.users.some((u) => u.id === userId)) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "You are not registered for this shift schedule",
			});
		}

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

	// Emit event for real-time updates (after transaction commits)
	shiftScheduleEvents.emitUpdate({
		type: "unregister",
		shiftScheduleId,
		userId,
		periodId,
		timestamp: new Date(),
	});

	return { success: true };
}
