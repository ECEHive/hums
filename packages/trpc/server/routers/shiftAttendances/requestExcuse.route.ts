import {
	computeOccurrenceEnd,
	computeOccurrenceStart,
	getExcuseRequestEligibility,
} from "@ecehive/features";
import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import z from "zod";
import type { TProtectedProcedureContext } from "../../trpc";

export const ZRequestExcuseSchema = z.object({
	attendanceId: z.number().min(1),
	reason: z.string().trim().min(1, "A reason is required").max(500),
});

export type TRequestExcuseSchema = z.infer<typeof ZRequestExcuseSchema>;

export type TRequestExcuseOptions = {
	ctx: TProtectedProcedureContext;
	input: TRequestExcuseSchema;
};

/**
 * Requests an excuse for one of the current user's attendance issues.
 *
 * The request appears as pending on the staff attendance issues page, where
 * staff either grant the excuse or mark it as unexcused.
 */
export async function requestExcuseHandler(options: TRequestExcuseOptions) {
	const { attendanceId, reason } = options.input;
	const userId = options.ctx.user.id;

	const attendance = await prisma.shiftAttendance.findUnique({
		where: { id: attendanceId },
		include: {
			shiftOccurrence: {
				include: {
					shiftSchedule: {
						select: { startTime: true, endTime: true },
					},
				},
			},
		},
	});

	// Treat other users' records as not found to not leak them
	if (!attendance || attendance.userId !== userId) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Attendance record not found",
		});
	}

	const { shiftSchedule } = attendance.shiftOccurrence;
	const shiftStart = computeOccurrenceStart(
		attendance.shiftOccurrence.timestamp,
		shiftSchedule.startTime,
	);
	const shiftEnd = computeOccurrenceEnd(
		shiftStart,
		shiftSchedule.startTime,
		shiftSchedule.endTime,
	);

	const eligibility = getExcuseRequestEligibility(attendance, shiftEnd);

	if (!eligibility.eligible) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: eligibility.reason,
		});
	}

	// Conditional update so a double submit can't overwrite the first request
	const now = new Date();
	const updateResult = await prisma.shiftAttendance.updateMany({
		where: {
			id: attendanceId,
			excuseRequestedAt: null,
			reviewedAt: null,
			isExcused: false,
		},
		data: {
			excuseRequestReason: reason,
			excuseRequestedAt: now,
		},
	});

	if (updateResult.count === 0) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "An excuse has already been requested for this shift",
		});
	}

	return {
		success: true,
		attendance: {
			id: attendanceId,
			excuseRequestReason: reason,
			excuseRequestedAt: now,
		},
	};
}
