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

	let presentCount = 0;
	let absentCount = 0;
	let lateCount = 0;
	let leftEarlyCount = 0;
	let totalHoursWorked = 0;
	let totalScheduledHours = 0;
	let droppedCount = 0;
	let droppedMakeupCount = 0;
	let attendanceEligibleShiftCount = 0;

	for (const attendance of attendances) {
		if (attendance.status === droppedStatus) {
			droppedCount++;
			continue;
		}

		if (attendance.status === droppedMakeupStatus) {
			droppedMakeupCount++;
			continue;
		}

		attendanceEligibleShiftCount++;

		switch (attendance.status) {
			case "present":
				presentCount++;
				break;
			case "absent":
				absentCount++;
				break;
			case "arrived_late":
				lateCount++;
				break;
			case "left_early":
				leftEarlyCount++;
				break;
			default:
				break;
		}

		if (attendance.timeIn && attendance.timeOut) {
			const durationMs =
				attendance.timeOut.getTime() - attendance.timeIn.getTime();
			totalHoursWorked += durationMs / (1000 * 60 * 60);
		}

		const [startHour, startMin] =
			attendance.shiftOccurrence.shiftSchedule.startTime.split(":").map(Number);
		const [endHour, endMin] = attendance.shiftOccurrence.shiftSchedule.endTime
			.split(":")
			.map(Number);
		const shiftStart = new Date(attendance.shiftOccurrence.timestamp);
		shiftStart.setHours(startHour, startMin, 0, 0);
		const shiftEnd = new Date(attendance.shiftOccurrence.timestamp);
		shiftEnd.setHours(endHour, endMin, 0, 0);

		if (shiftEnd < shiftStart) {
			shiftEnd.setDate(shiftEnd.getDate() + 1);
		}

		const scheduledDurationMs = shiftEnd.getTime() - shiftStart.getTime();
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

	// Get upcoming shifts (occurrences assigned to user that haven't happened yet)
	const now = new Date();
	const upcomingShiftsWhere: {
		userId: number;
		status: { notIn: ShiftAttendanceStatus[] };
		shiftOccurrence: {
			timestamp: { gt: Date };
			shiftSchedule?: {
				shiftType?: {
					periodId?: number;
				};
			};
		};
	} = {
		userId,
		status: { notIn: [droppedStatus, droppedMakeupStatus] },
		shiftOccurrence: {
			timestamp: { gt: now },
		},
	};

	if (periodId) {
		upcomingShiftsWhere.shiftOccurrence.shiftSchedule = {
			shiftType: {
				periodId,
			},
		};
	}

	const upcomingShiftsCount = await prisma.shiftAttendance.count({
		where: upcomingShiftsWhere,
	});

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
