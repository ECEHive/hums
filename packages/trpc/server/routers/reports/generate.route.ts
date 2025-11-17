import { type Prisma, prisma } from "@ecehive/prisma";
import { computeOccurrenceStart, computeOccurrenceEnd } from "@ecehive/features";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZGenerateSchema = z.object({
	startDate: z.string().optional(),
	endDate: z.string().optional(),
	periodId: z.number(),
	staffingRoleId: z.number(),
});

export type TGenerateSchema = z.infer<typeof ZGenerateSchema>;

export type TGenerateOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TGenerateSchema;
};

function convert24HourToMS(timeStr: string): number {
	const [hours, minutes] = timeStr.split(":").map(Number);
	return hours * 3600000 + minutes * 60000;
}

export async function generateHandler(options: TGenerateOptions) {
	const { staffingRoleId, startDate, endDate } = options.input;

	const whereForAttendance: Prisma.ShiftAttendanceWhereInput = {
		user: {
			roles: {
				some: {
					id: staffingRoleId,
				},
			},
		},
		shiftOccurrence: {
			shiftSchedule: {
				shiftType: {
					periodId: options.input.periodId,
				},
			},
		},
	};

	const whereForOccurrence: Prisma.ShiftOccurrenceWhereInput = {
		users: {
			some: {
				roles: {
					some: { id: staffingRoleId },
				},
			},
		},
		shiftSchedule: {
			shiftType: {
				periodId: options.input.periodId,
			},
		},
	};

	// If startDate / endDate provided, filter by the related shiftOccurrence.timestamp
	if (startDate || endDate) {
		const timestampFilter: Prisma.DateTimeFilter = {};

		if (startDate) {
			const sd = new Date(startDate);
			if (!Number.isNaN(sd.getTime())) {
				timestampFilter.gte = sd;
			}
		}

		if (endDate) {
			const ed = new Date(endDate);
			if (!Number.isNaN(ed.getTime())) {
				timestampFilter.lte = ed;
			}
		}

		// Only attach the filter if at least one bound is valid
		if (Object.keys(timestampFilter).length > 0) {
			// avoid using `any` by casting to a minimal mutable shape
			const whereMutable = whereForAttendance as unknown as {
				shiftOccurrence?: { timestamp?: Prisma.DateTimeFilter };
			};
			whereMutable.shiftOccurrence = { timestamp: timestampFilter };
			// Also attach the same timestamp filter to occurrences query so DB returns only relevant occurrences
			const whereOccMutable = whereForOccurrence as unknown as {
				timestamp?: Prisma.DateTimeFilter;
			};
			whereOccMutable.timestamp = timestampFilter;
		}
	}

	const shiftAttendances = await prisma.shiftAttendance.findMany({
		where: whereForAttendance,
		include: {
			user: true,
			shiftOccurrence: {
				include: {
					shiftSchedule: true,
				},
			}
		},
		orderBy: {
			user: { username: "asc" },
		},
	});

	const shiftOccurrences = await prisma.shiftOccurrence.findMany({
		where: whereForOccurrence,
		include: {
			users: true,
			shiftSchedule: true,
		},
	});

	// Aggregate shiftAttendances by user id for robust lookups
	const userMap = new Map<
		number,
		{
			id: number;
			username: string;
			name: string;
			shiftAttendances: {
				id: number;
				status: string;
				timeIn: Date | null;
				timeOut: Date | null;
				startTime: string;
				endTime: string;
			}[];
		}
	>();

	shiftAttendances.forEach((attendance) => {
		const uid = attendance.user.id;
		if (!userMap.has(uid)) {
			userMap.set(uid, {
				id: attendance.user.id,
				username: attendance.user.username,
				name: attendance.user.name,
				shiftAttendances: [
					{
						id: attendance.id,
						status: attendance.status,
						timeIn: attendance.timeIn,
						timeOut: attendance.timeOut,
						startTime: attendance.shiftOccurrence.shiftSchedule.startTime,
						endTime: attendance.shiftOccurrence.shiftSchedule.endTime,
					},
				],
			});
		} else {
			userMap.get(uid)?.shiftAttendances.push({
				id: attendance.id,
				status: attendance.status,
				timeIn: attendance.timeIn,
				timeOut: attendance.timeOut,
				startTime: attendance.shiftOccurrence.shiftSchedule.startTime,
				endTime: attendance.shiftOccurrence.shiftSchedule.endTime,
			});
		}
	});

	const userReports: {
		reports: {
			id: number;
			name: string;
			username: string;
			periodScheduledTime: number;
			pastScheduledTime: number;
			pastAttendedTime: number;
			pastMissedTime: number;
			pastAttendancePercentage: number;
		}[];
		total: number;
	} = { reports: [], total: 0 };

	userMap.forEach((user) => {
		const totalScheduledTime = user.shiftAttendances.reduce(
			(acc, attendance) => {
				return (
					acc + (convert24HourToMS(attendance.endTime) - convert24HourToMS(attendance.startTime)) / 3600000 // convert ms to hours
				);
			},
			0,
		);

		const totalAttendedTime = user.shiftAttendances.reduce(
			(acc, attendance) => {
				if (
					attendance.status === "present" &&
					attendance.timeIn &&
					attendance.timeOut
				) {
					return (
						acc + (attendance.timeOut.getTime() - attendance.timeIn.getTime()) / 3600000 // convert ms to hours
					);
				}
				return acc;
			},
			0,
		);

		const totalMissedTime = user.shiftAttendances.reduce(
			(acc, attendance) => {
				if (attendance.status === "absent") {
					return (
						acc + (convert24HourToMS(attendance.endTime) - convert24HourToMS(attendance.startTime)) / 3600000 // convert ms to hours
					);
				}
				return acc;
			},
			0,
		);

		const attendancePercentage =
			totalScheduledTime > 0
				? (totalAttendedTime / totalScheduledTime) * 100
				: 0;

		userReports.reports.push({
			id: user.id,
			name: user.name,
			username: user.username,
			periodScheduledTime: 0, // Will be calculated next
			pastScheduledTime: totalScheduledTime,
			pastAttendedTime: totalAttendedTime,
			pastMissedTime: totalMissedTime,
			pastAttendancePercentage: attendancePercentage,
		});
	});

	// Build an index by user id into the reports array for O(1) updates
	const idIndex = new Map<number, number>();
	userReports.reports.forEach((r, i) => {
		idIndex.set(r.id, i);
	});

	// Parse the report window bounds once
	const periodStartDate = startDate ? new Date(startDate) : null;
	const periodEndDate = endDate ? new Date(endDate) : null;

	for (const occurrence of shiftOccurrences) {
		const occStart = computeOccurrenceStart(
			occurrence.timestamp,
			occurrence.shiftSchedule.startTime,
		);
		const occEnd = computeOccurrenceEnd(
			occurrence.timestamp,
			occurrence.shiftSchedule.startTime,
			occurrence.shiftSchedule.endTime,
		);

		// Clamp to report bounds if provided
		const effectiveStart = periodStartDate
			? new Date(Math.max(occStart.getTime(), periodStartDate.getTime()))
			: occStart;
		const effectiveEnd = periodEndDate
			? new Date(Math.min(occEnd.getTime(), periodEndDate.getTime()))
			: occEnd;

		const durationHours = Math.max(0, effectiveEnd.getTime() - effectiveStart.getTime()) / 3600000;
		if (durationHours <= 0) continue;

		for (const user of occurrence.users) {
			const idx = idIndex.get(user.id);
			if (idx !== undefined) {
				userReports.reports[idx].periodScheduledTime += durationHours;
			} else {
				// User present in occurrences but not in attendances; add them
				userReports.reports.push({
					id: user.id,
					name: user.name,
					username: user.username,
					periodScheduledTime: durationHours,
					pastScheduledTime: 0,
					pastAttendedTime: 0,
					pastMissedTime: 0,
					pastAttendancePercentage: 0,
				});
				idIndex.set(user.id, userReports.reports.length - 1);
			}
		}
	}

	// Add total count
	userReports.total = userReports.reports.length;

	return userReports;
}
