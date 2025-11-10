import { TZDate } from "@date-fns/tz";
import { env } from "@ecehive/env";
import { prisma } from "@ecehive/prisma";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZListMyPastSchema = z.object({
	periodId: z.number().min(1),
	limit: z.number().min(1).max(100).optional(),
	offset: z.number().min(0).optional(),
});

export type TListMyPastSchema = z.infer<typeof ZListMyPastSchema>;

export type TListMyPastOptions = {
	ctx: TPermissionProtectedProcedureContext;
	input: TListMyPastSchema;
};

/**
 * Parse time string in HH:MM:SS format to hours and minutes
 */
function parseTime(time: string): { hours: number; minutes: number } {
	const parts = time.split(":");
	return {
		hours: Number.parseInt(parts[0], 10),
		minutes: Number.parseInt(parts[1], 10),
	};
}

/**
 * Compute the end timestamp of a shift occurrence in the configured timezone
 */
function computeOccurrenceEnd(
	start: Date,
	startTime: string,
	endTime: string,
): Date {
	const startComponents = parseTime(startTime);
	const endComponents = parseTime(endTime);

	// Convert start date to TZ-aware date in the configured timezone
	const tzStart = new TZDate(start, env.TZ);

	// Create end date in the same timezone - use the date from tzStart and set the end time
	const tzEnd = new TZDate(
		tzStart.getFullYear(),
		tzStart.getMonth(),
		tzStart.getDate(),
		endComponents.hours,
		endComponents.minutes,
		0,
		env.TZ,
	);

	// If end time is earlier than start time, shift wraps to next day
	if (
		endComponents.hours < startComponents.hours ||
		(endComponents.hours === startComponents.hours &&
			endComponents.minutes <= startComponents.minutes)
	) {
		tzEnd.setDate(tzEnd.getDate() + 1);
	}

	return tzEnd;
}

/**
 * List past shift occurrences for the current user in a specific period
 */
export async function listMyPastHandler(options: TListMyPastOptions) {
	const { periodId, limit = 50, offset = 0 } = options.input;
	const userId = options.ctx.userId;

	const now = new Date();

	// Get all shift occurrences for the user in this period
	const allOccurrences = await prisma.shiftOccurrence.findMany({
		where: {
			users: {
				some: {
					id: userId,
				},
			},
			shiftSchedule: {
				shiftType: {
					periodId,
				},
			},
			// Get shifts that started before now
			timestamp: {
				lte: now,
			},
		},
		include: {
			shiftSchedule: {
				include: {
					shiftType: true,
				},
			},
			users: {
				select: {
					id: true,
					name: true,
				},
			},
			attendances: {
				where: {
					userId,
				},
				select: {
					id: true,
					status: true,
					timeIn: true,
					timeOut: true,
				},
			},
		},
		orderBy: {
			timestamp: "desc", // Most recent first
		},
	});

	// Filter to only past shifts and compute stats
	const pastOccurrencesWithData = allOccurrences
		.map((occ) => {
			const occStart = new Date(occ.timestamp);
			const occEnd = computeOccurrenceEnd(
				occStart,
				occ.shiftSchedule.startTime,
				occ.shiftSchedule.endTime,
			);

			const attendance = occ.attendances[0];

			// Calculate shift duration in hours
			const shiftDurationMs = occEnd.getTime() - occStart.getTime();
			const shiftDurationHours = shiftDurationMs / (1000 * 60 * 60);

			// Calculate attendance duration if present
			let attendanceDurationHours = 0;
			if (attendance?.timeIn && attendance?.timeOut) {
				const attendanceDurationMs =
					attendance.timeOut.getTime() - attendance.timeIn.getTime();
				attendanceDurationHours = attendanceDurationMs / (1000 * 60 * 60);
			}

			return {
				occurrence: occ,
				occStart,
				occEnd,
				shiftDurationHours,
				attendanceDurationHours,
				isPast: occEnd <= now,
			};
		})
		.filter((item) => item.isPast);

	// Calculate statistics
	const totalShifts = pastOccurrencesWithData.length;
	const totalShiftHours = pastOccurrencesWithData.reduce(
		(sum, item) => sum + item.shiftDurationHours,
		0,
	);
	const totalAttendanceHours = pastOccurrencesWithData.reduce(
		(sum, item) => sum + item.attendanceDurationHours,
		0,
	);
	const attendancePercentage =
		totalShiftHours > 0 ? (totalAttendanceHours / totalShiftHours) * 100 : 0;

	// Paginate the results
	const paginatedOccurrences = pastOccurrencesWithData
		.slice(offset, offset + limit)
		.map((item) => ({
			id: item.occurrence.id,
			timestamp: item.occurrence.timestamp,
			slot: item.occurrence.slot,
			shiftScheduleId: item.occurrence.shiftScheduleId,
			shiftTypeName: item.occurrence.shiftSchedule.shiftType.name,
			shiftTypeLocation: item.occurrence.shiftSchedule.shiftType.location,
			shiftTypeColor: item.occurrence.shiftSchedule.shiftType.color,
			startTime: item.occurrence.shiftSchedule.startTime,
			endTime: item.occurrence.shiftSchedule.endTime,
			dayOfWeek: item.occurrence.shiftSchedule.dayOfWeek,
			users: item.occurrence.users,
			attendance: item.occurrence.attendances[0] || null,
			shiftDurationHours: item.shiftDurationHours,
			attendanceDurationHours: item.attendanceDurationHours,
		}));

	return {
		occurrences: paginatedOccurrences,
		total: totalShifts,
		stats: {
			totalShifts,
			totalShiftHours,
			totalAttendanceHours,
			attendancePercentage,
		},
	};
}
