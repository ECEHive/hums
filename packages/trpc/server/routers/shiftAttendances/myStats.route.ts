import {
	computeOccurrenceEnd,
	computeOccurrenceStart,
} from "@ecehive/features";
import { prisma, type ShiftAttendanceStatus } from "@ecehive/prisma";
import z from "zod";
import type { TProtectedProcedureContext } from "../../trpc";

export const ZMyStatsSchema = z.object({
	periodId: z.number().min(1).optional(),
});

export type TMyStatsSchema = z.infer<typeof ZMyStatsSchema>;

export type TMyStatsOptions = {
	ctx: TProtectedProcedureContext;
	input: TMyStatsSchema;
};

export async function myStatsHandler(options: TMyStatsOptions) {
	const userId = options.ctx.user.id;
	const { periodId } = options.input;

	// Build where clause
	const where: {
		userId: number;
		shiftOccurrence?: {
			shiftSchedule?: {
				shiftType?: {
					periodId?: number;
				};
			};
		};
	} = { userId };

	if (periodId) {
		where.shiftOccurrence = {
			shiftSchedule: {
				shiftType: {
					periodId,
				},
			},
		};
	}

	// Get all attendances for the user
	const attendances = await prisma.shiftAttendance.findMany({
		where,
		select: {
			id: true,
			status: true,
			timeIn: true,
			timeOut: true,
			didArriveLate: true,
			didLeaveEarly: true,
			isMakeup: true,
			shiftOccurrence: {
				select: {
					timestamp: true,
					shiftSchedule: {
						select: {
							startTime: true,
							endTime: true,
						},
					},
				},
			},
		},
	});

	const droppedStatus = "dropped" as ShiftAttendanceStatus;
	const droppedMakeupStatus = "dropped_makeup" as ShiftAttendanceStatus;
	const upcomingStatus = "upcoming" as ShiftAttendanceStatus;

	let presentCount = 0;
	let absentCount = 0;
	let lateCount = 0;
	let leftEarlyCount = 0;
	let totalHoursWorked = 0;
	let totalScheduledHours = 0;
	let droppedCount = 0;
	let droppedMakeupCount = 0;
	let attendanceEligibleShiftCount = 0;
	let upcomingShiftsCount = 0;
	const now = new Date();

	for (const attendance of attendances) {
		if (attendance.status === droppedStatus) {
			droppedCount++;
			continue;
		}

		if (attendance.status === droppedMakeupStatus) {
			droppedMakeupCount++;
			continue;
		}

		// Handle upcoming status explicitly
		if (attendance.status === upcomingStatus) {
			upcomingShiftsCount++;
			continue;
		}

		const scheduledStart = computeOccurrenceStart(
			new Date(attendance.shiftOccurrence.timestamp),
			attendance.shiftOccurrence.shiftSchedule.startTime,
		);
		const scheduledEnd = computeOccurrenceEnd(
			scheduledStart,
			attendance.shiftOccurrence.shiftSchedule.startTime,
			attendance.shiftOccurrence.shiftSchedule.endTime,
		);

		// Also check by date in case status hasn't been updated yet
		if (scheduledStart > now) {
			upcomingShiftsCount++;
			continue;
		}

		attendanceEligibleShiftCount++;

		if (attendance.status === "present") {
			presentCount++;
		} else if (attendance.status === "absent") {
			absentCount++;
		}

		if (attendance.didArriveLate) {
			lateCount++;
		}
		if (attendance.didLeaveEarly) {
			leftEarlyCount++;
		}

		if (attendance.timeIn && attendance.timeOut) {
			const durationMs =
				attendance.timeOut.getTime() - attendance.timeIn.getTime();
			totalHoursWorked += durationMs / (1000 * 60 * 60);
		}

		const scheduledDurationMs =
			scheduledEnd.getTime() - scheduledStart.getTime();
		totalScheduledHours += scheduledDurationMs / (1000 * 60 * 60);
	}

	const totalShifts = attendances.length;
	const attendanceRate =
		attendanceEligibleShiftCount > 0
			? (presentCount / attendanceEligibleShiftCount) * 100
			: 0;
	const timeOnShiftPercentage =
		totalScheduledHours > 0
			? (totalHoursWorked / totalScheduledHours) * 100
			: 0;

	return {
		totalShifts,
		presentCount,
		absentCount,
		lateCount,
		leftEarlyCount,
		droppedCount,
		droppedMakeupCount,
		attendanceRate: Math.round(attendanceRate * 100) / 100,
		totalHoursWorked: Math.round(totalHoursWorked * 100) / 100,
		totalScheduledHours: Math.round(totalScheduledHours * 100) / 100,
		timeOnShiftPercentage: Math.round(timeOnShiftPercentage * 100) / 100,
		upcomingShiftsCount,
	};
}
