import {
	db,
	periods,
	shiftScheduleAssignments,
	shiftSchedules,
	shiftTypes,
} from "@ecehive/drizzle";
import { unassignUserFromScheduleOccurrences } from "@ecehive/features";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
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
	const userId = options.ctx.user.id;

	return await db.transaction(async (tx) => {
		// Get the shift schedule with period info
		const [scheduleInfo] = await tx
			.select({
				scheduleId: shiftSchedules.id,
				periodId: periods.id,
				scheduleSignupStart: periods.scheduleSignupStart,
				scheduleSignupEnd: periods.scheduleSignupEnd,
			})
			.from(shiftSchedules)
			.innerJoin(shiftTypes, eq(shiftSchedules.shiftTypeId, shiftTypes.id))
			.innerJoin(periods, eq(shiftTypes.periodId, periods.id))
			.where(eq(shiftSchedules.id, shiftScheduleId))
			.limit(1);

		if (!scheduleInfo) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "Shift schedule not found",
			});
		}

		// Check if registration changes are allowed
		const now = new Date();
		const signupStart = scheduleInfo.scheduleSignupStart;
		const signupEnd = scheduleInfo.scheduleSignupEnd;

		if (!signupStart || !signupEnd) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "Registration period not configured for this period",
			});
		}

		if (now < signupStart || now > signupEnd) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "Registration changes are not currently allowed for this period",
			});
		}

		// Check if user is registered
		const [existing] = await tx
			.select()
			.from(shiftScheduleAssignments)
			.where(
				and(
					eq(shiftScheduleAssignments.shiftScheduleId, shiftScheduleId),
					eq(shiftScheduleAssignments.userId, userId),
				),
			)
			.limit(1);

		if (!existing) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "Not registered for this shift schedule",
			});
		}

		// Remove the schedule assignment
		await tx
			.delete(shiftScheduleAssignments)
			.where(eq(shiftScheduleAssignments.id, existing.id));

		// Remove user from all occurrences of this schedule
		await unassignUserFromScheduleOccurrences(tx, shiftScheduleId, userId);

		return { success: true };
	});
}
