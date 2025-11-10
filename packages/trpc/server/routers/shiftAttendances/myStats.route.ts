import { prisma } from "@ecehive/prisma";
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

	// Calculate statistics
	const totalShifts = attendances.length;
	const presentCount = attendances.filter((a) => a.status === "present").length;
	const absentCount = attendances.filter((a) => a.status === "absent").length;
	const lateCount = attendances.filter(
		(a) => a.status === "arrived_late",
	).length;
	const leftEarlyCount = attendances.filter(
		(a) => a.status === "left_early",
	).length;

	// Calculate attendance rate
	const attendanceRate =
		totalShifts > 0 ? (presentCount / totalShifts) * 100 : 0;

	// Calculate total hours worked
	let totalHoursWorked = 0;
	for (const attendance of attendances) {
		if (attendance.timeIn && attendance.timeOut) {
			const durationMs =
				attendance.timeOut.getTime() - attendance.timeIn.getTime();
			totalHoursWorked += durationMs / (1000 * 60 * 60);
		}
	}

	// Get upcoming shifts (occurrences assigned to user that haven't happened yet)
	const now = new Date();
	const upcomingShiftsWhere: {
		userId: number;
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
		attendanceRate: Math.round(attendanceRate * 100) / 100,
		totalHoursWorked: Math.round(totalHoursWorked * 100) / 100,
		upcomingShiftsCount,
	};
}
