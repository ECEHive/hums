import { prisma, type ShiftAttendanceStatus } from "@ecehive/prisma";
import z from "zod";
import type { TProtectedProcedureContext } from "../../trpc";

export const ZListMySchema = z.object({
	limit: z.number().min(1).max(100).optional(),
	offset: z.number().min(0).optional(),
	periodId: z.number().min(1).optional(),
});

export type TListMySchema = z.infer<typeof ZListMySchema>;

export type TListMyOptions = {
	ctx: TProtectedProcedureContext;
	input: TListMySchema;
};

export async function listMyHandler(options: TListMyOptions) {
	const userId = options.ctx.user.id;
	const { limit = 50, offset = 0, periodId } = options.input;

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

	const [attendances, total] = await Promise.all([
		prisma.shiftAttendance.findMany({
			where,
			orderBy: {
				shiftOccurrence: {
					timestamp: "desc",
				},
			},
			skip: offset,
			take: limit,
			select: {
				id: true,
				status: true,
				timeIn: true,
				timeOut: true,
				createdAt: true,
				shiftOccurrence: {
					select: {
						id: true,
						timestamp: true,
						shiftSchedule: {
							select: {
								id: true,
								dayOfWeek: true,
								startTime: true,
								endTime: true,
								shiftType: {
									select: {
										id: true,
										name: true,
										location: true,
										color: true,
										icon: true,
										period: {
											select: {
												id: true,
												name: true,
											},
										},
									},
								},
							},
						},
					},
				},
			},
		}),
		prisma.shiftAttendance.count({ where }),
	]);

	// Calculate time on shift percentage for each attendance
	const droppedStatuses = new Set<ShiftAttendanceStatus>([
		"dropped" as ShiftAttendanceStatus,
		"dropped_makeup" as ShiftAttendanceStatus,
	]);

	const attendancesWithPercentage = attendances.map((attendance) => {
		let timeOnShiftPercentage: number | null = null;
		let scheduledHours: number | null = null;
		let actualHours: number | null = null;
		const isDroppedStatus = droppedStatuses.has(
			attendance.status as ShiftAttendanceStatus,
		);

		if (isDroppedStatus) {
			return {
				...attendance,
				scheduledHours,
				actualHours,
				timeOnShiftPercentage,
			};
		}

		// Calculate scheduled shift duration
		const [startHour, startMin] =
			attendance.shiftOccurrence.shiftSchedule.startTime.split(":").map(Number);
		const [endHour, endMin] = attendance.shiftOccurrence.shiftSchedule.endTime
			.split(":")
			.map(Number);
		const shiftStart = new Date(attendance.shiftOccurrence.timestamp);
		shiftStart.setHours(startHour, startMin, 0, 0);
		const shiftEnd = new Date(attendance.shiftOccurrence.timestamp);
		shiftEnd.setHours(endHour, endMin, 0, 0);

		// Handle shifts that cross midnight
		if (shiftEnd < shiftStart) {
			shiftEnd.setDate(shiftEnd.getDate() + 1);
		}

		const scheduledDurationMs = shiftEnd.getTime() - shiftStart.getTime();
		scheduledHours = scheduledDurationMs / (1000 * 60 * 60);

		// Calculate actual hours worked
		if (attendance.timeIn && attendance.timeOut) {
			const actualDurationMs =
				attendance.timeOut.getTime() - attendance.timeIn.getTime();
			actualHours = actualDurationMs / (1000 * 60 * 60);

			// Calculate percentage
			if (scheduledHours > 0) {
				timeOnShiftPercentage =
					Math.round((actualHours / scheduledHours) * 100 * 100) / 100;
			}
		}

		return {
			...attendance,
			scheduledHours: Math.round(scheduledHours * 100) / 100,
			actualHours: actualHours ? Math.round(actualHours * 100) / 100 : null,
			timeOnShiftPercentage,
		};
	});

	return {
		attendances: attendancesWithPercentage,
		total,
	};
}
