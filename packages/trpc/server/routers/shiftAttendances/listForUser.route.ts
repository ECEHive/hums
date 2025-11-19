import { assertCanAccessPeriod, getUserWithRoles } from "@ecehive/features";
import type { Prisma } from "@ecehive/prisma";
import { prisma, type ShiftAttendanceStatus } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZListForUserSchema = z.object({
	periodId: z.number().min(1),
	userId: z.number().min(1),
	limit: z.number().min(1).max(100).optional(),
	offset: z.number().min(0).optional(),
});

export type TListForUserSchema = z.infer<typeof ZListForUserSchema>;

export type TListForUserOptions = {
	ctx: TPermissionProtectedProcedureContext;
	input: TListForUserSchema;
};

export async function listForUserHandler(options: TListForUserOptions) {
	const { periodId, userId, limit = 50, offset = 0 } = options.input;

	const actor = await getUserWithRoles(prisma, options.ctx.user.id);

	if (!actor) {
		throw new TRPCError({
			code: "UNAUTHORIZED",
			message: "User not found",
		});
	}

	const actorRoleIds = new Set(actor.roles.map((role) => role.id));

	const period = await prisma.period.findUnique({
		where: { id: periodId },
		include: {
			roles: { select: { id: true } },
		},
	});

	if (!period) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Period not found",
		});
	}

	assertCanAccessPeriod(period, actorRoleIds, {
		isSystemUser: options.ctx.user.isSystemUser,
	});

	const targetUser = await prisma.user.findUnique({
		where: { id: userId },
		include: {
			roles: { select: { id: true } },
		},
	});

	if (!targetUser) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Target user not found",
		});
	}

	const requiredRoleIds = period.roles.map((role) => role.id);

	if (
		requiredRoleIds.length > 0 &&
		!targetUser.roles.some((role) => requiredRoleIds.includes(role.id))
	) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "User is not eligible for this period",
		});
	}

	const where: Prisma.ShiftAttendanceWhereInput = {
		userId,
		shiftOccurrence: {
			shiftSchedule: {
				shiftType: {
					periodId,
				},
			},
		},
	};

	const [attendances, total, stats] = await Promise.all([
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
				droppedNotes: true,
				timeIn: true,
				timeOut: true,
				didArriveLate: true,
				didLeaveEarly: true,
				isMakeup: true,
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
		computeAttendanceSummary(where),
	]);

	const droppedStatuses = new Set<ShiftAttendanceStatus>([
		"dropped" as ShiftAttendanceStatus,
		"dropped_makeup" as ShiftAttendanceStatus,
	]);

	const attendancesWithStats = attendances.map((attendanceRecord) => {
		let timeOnShiftPercentage: number | null = null;
		let scheduledHours: number | null = null;
		let actualHours: number | null = null;
		const isDroppedStatus = droppedStatuses.has(
			attendanceRecord.status as ShiftAttendanceStatus,
		);
		const isUpcomingStatus = attendanceRecord.status === "upcoming";

		if (isDroppedStatus || isUpcomingStatus) {
			return {
				...attendanceRecord,
				scheduledHours,
				actualHours,
				timeOnShiftPercentage,
			};
		}

		const [startHour, startMinute] =
			attendanceRecord.shiftOccurrence.shiftSchedule.startTime
				.split(":")
				.map(Number);
		const [endHour, endMinute] =
			attendanceRecord.shiftOccurrence.shiftSchedule.endTime
				.split(":")
				.map(Number);
		const shiftStart = new Date(attendanceRecord.shiftOccurrence.timestamp);
		shiftStart.setHours(startHour, startMinute, 0, 0);
		const shiftEnd = new Date(attendanceRecord.shiftOccurrence.timestamp);
		shiftEnd.setHours(endHour, endMinute, 0, 0);

		if (shiftEnd < shiftStart) {
			shiftEnd.setDate(shiftEnd.getDate() + 1);
		}

		const scheduledDurationMs = shiftEnd.getTime() - shiftStart.getTime();
		scheduledHours = scheduledDurationMs / (1000 * 60 * 60);

		if (attendanceRecord.timeIn && attendanceRecord.timeOut) {
			const actualDurationMs =
				attendanceRecord.timeOut.getTime() - attendanceRecord.timeIn.getTime();
			actualHours = actualDurationMs / (1000 * 60 * 60);

			if (scheduledHours > 0) {
				timeOnShiftPercentage =
					Math.round((actualHours / scheduledHours) * 100 * 100) / 100;
			}
		}

		return {
			...attendanceRecord,
			scheduledHours: Math.round(scheduledHours * 100) / 100,
			actualHours: actualHours ? Math.round(actualHours * 100) / 100 : null,
			timeOnShiftPercentage,
		};
	});

	return {
		attendances: attendancesWithStats,
		total,
		stats,
	};
}

type AttendanceSummaryRecord = {
	status: ShiftAttendanceStatus;
	timeIn: Date | null;
	timeOut: Date | null;
	shiftOccurrence: {
		timestamp: Date;
		shiftSchedule: {
			startTime: string;
			endTime: string;
		};
	};
};

type AttendanceSummaryStats = {
	attended: number;
	missed: number;
	dropped: number;
	droppedWithMakeup: number;
	totalScheduledHours: number;
	totalActualHours: number;
	attendanceCoveragePercent: number;
};

async function computeAttendanceSummary(
	where: Prisma.ShiftAttendanceWhereInput,
): Promise<AttendanceSummaryStats> {
	const records: AttendanceSummaryRecord[] =
		await prisma.shiftAttendance.findMany({
			where,
			select: {
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

	return summarizeAttendanceRecords(records);
}

function summarizeAttendanceRecords(
	records: AttendanceSummaryRecord[],
): AttendanceSummaryStats {
	let attended = 0;
	let missed = 0;
	let dropped = 0;
	let droppedWithMakeup = 0;
	let totalScheduledHours = 0;
	let totalActualHours = 0;

	for (const record of records) {
		switch (record.status) {
			case "present":
				attended += 1;
				break;
			case "absent":
				missed += 1;
				break;
			case "dropped":
				dropped += 1;
				break;
			case "dropped_makeup":
				droppedWithMakeup += 1;
				break;
			default:
				break;
		}

		const shouldCountHours =
			record.status === "present" || record.status === "absent";
		if (!shouldCountHours) {
			continue;
		}

		const scheduledHours = calculateScheduledHours(record);
		totalScheduledHours += scheduledHours;

		if (record.timeIn && record.timeOut) {
			const actualHours =
				(record.timeOut.getTime() - record.timeIn.getTime()) / (1000 * 60 * 60);
			totalActualHours += actualHours;
		}
	}

	const roundedScheduledHours = Math.round(totalScheduledHours * 100) / 100;
	const roundedActualHours = Math.round(totalActualHours * 100) / 100;
	const attendanceCoveragePercent =
		roundedScheduledHours > 0
			? Math.round((roundedActualHours / roundedScheduledHours) * 1000) / 10
			: 0;

	return {
		attended,
		missed,
		dropped,
		droppedWithMakeup,
		totalScheduledHours: roundedScheduledHours,
		totalActualHours: roundedActualHours,
		attendanceCoveragePercent,
	};
}

function calculateScheduledHours(record: AttendanceSummaryRecord) {
	const [startHour, startMinute] =
		record.shiftOccurrence.shiftSchedule.startTime.split(":").map(Number);
	const [endHour, endMinute] = record.shiftOccurrence.shiftSchedule.endTime
		.split(":")
		.map(Number);
	const shiftStart = new Date(record.shiftOccurrence.timestamp);
	shiftStart.setHours(startHour, startMinute, 0, 0);
	const shiftEnd = new Date(record.shiftOccurrence.timestamp);
	shiftEnd.setHours(endHour, endMinute, 0, 0);

	if (shiftEnd < shiftStart) {
		shiftEnd.setDate(shiftEnd.getDate() + 1);
	}

	return (shiftEnd.getTime() - shiftStart.getTime()) / (1000 * 60 * 60);
}
