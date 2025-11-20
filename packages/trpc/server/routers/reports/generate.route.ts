import {
	computeOccurrenceEnd,
	computeOccurrenceStart,
} from "@ecehive/features";
import { type Prisma, prisma } from "@ecehive/prisma";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZGenerateSchema = z.object({
	startDate: z.string().optional(),
	endDate: z.string().optional(),
	periodId: z.number(),
	staffingRoleIds: z.array(z.number()).optional(),
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
	const { staffingRoleIds, startDate, endDate } = options.input;

	// If staffingRoleIds is undefined or an empty array, treat it as "no role
	// filter" (i.e. return all users). Only apply a role-based filter when a
	// non-empty array of role ids is provided.
	const roleIds =
		staffingRoleIds && staffingRoleIds.length > 0
			? (staffingRoleIds as number[])
			: undefined;

	const whereForAttendance: Prisma.ShiftAttendanceWhereInput = {
		// only apply user role constraint when a non-empty set of roleIds is provided
		...(roleIds
			? {
					user: {
						roles: {
							some: {
								id: { in: roleIds },
							},
						},
					},
				}
			: {}),
		// always scope by the period's shift types
		shiftOccurrence: {
			shiftSchedule: {
				shiftType: {
					periodId: options.input.periodId,
				},
			},
		},
	};

	const whereForOccurrence: Prisma.ShiftOccurrenceWhereInput = {
		// only apply users.roles filter when a non-empty set of roleIds is provided
		...(roleIds
			? {
					users: {
						some: {
							roles: {
								some: { id: { in: roleIds } },
							},
						},
					},
				}
			: {}),
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

	// Build report by querying users once and including filtered attendances/occurrences.
	// This keeps a single DB round-trip and still lets us compute timezone-aware durations in JS.
	const periodStartDate = startDate ? new Date(startDate) : null;
	const periodEndDate = endDate ? new Date(endDate) : null;

	// Prepare include filters for relations (strip top-level user role filters)
	const attendanceIncludeWhere: Prisma.ShiftAttendanceWhereInput | undefined =
		whereForAttendance.shiftOccurrence
			? { shiftOccurrence: whereForAttendance.shiftOccurrence }
			: undefined;

	const occurrenceIncludeWhere: Prisma.ShiftOccurrenceWhereInput = {
		...whereForOccurrence,
	} as Prisma.ShiftOccurrenceWhereInput;

	type UserWithRelations = {
		id: number;
		username: string;
		name: string;
		attendances?: Array<{
			status: string;
			timeIn: Date | null;
			timeOut: Date | null;
			shiftOccurrence: {
				shiftSchedule: { startTime: string; endTime: string };
			};
		}>;
		shiftOccurrences?: Array<{
			timestamp: Date;
			shiftSchedule: { startTime: string; endTime: string };
		}>;
	};

	const usersWithRelations = (await prisma.user.findMany({
		where: roleIds ? { roles: { some: { id: { in: roleIds } } } } : undefined,
		select: {
			id: true,
			username: true,
			name: true,
			attendances: {
				where: attendanceIncludeWhere,
				include: {
					shiftOccurrence: {
						include: { shiftSchedule: true },
					},
				},
			},
			shiftOccurrences: {
				where: occurrenceIncludeWhere,
				include: { shiftSchedule: true },
			},
		},
		orderBy: { username: "asc" },
	})) as UserWithRelations[];

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
	} = { reports: [], total: usersWithRelations.length };

	for (const u of usersWithRelations) {
		let pastScheduledTime = 0;
		let pastAttendedTime = 0;
		let pastMissedTime = 0;

		for (const attendance of u.attendances ?? []) {
			const scheduledHours =
				(convert24HourToMS(attendance.shiftOccurrence.shiftSchedule.endTime) -
					convert24HourToMS(
						attendance.shiftOccurrence.shiftSchedule.startTime,
					)) /
				3600000;

			const attendedHours =
				attendance.status === "present" &&
				attendance.timeIn &&
				attendance.timeOut
					? (attendance.timeOut.getTime() - attendance.timeIn.getTime()) /
						3600000
					: 0;

			const missedHours = attendance.status === "absent" ? scheduledHours : 0;

			pastScheduledTime += scheduledHours;
			pastAttendedTime += attendedHours;
			pastMissedTime += missedHours;
		}

		// Sum scheduled time from occurrences (clamped to report window)
		let periodScheduledTime = 0;
		for (const occ of u.shiftOccurrences ?? []) {
			const occStart = computeOccurrenceStart(
				occ.timestamp,
				occ.shiftSchedule.startTime,
			);
			const occEnd = computeOccurrenceEnd(
				occ.timestamp,
				occ.shiftSchedule.startTime,
				occ.shiftSchedule.endTime,
			);

			const effectiveStart = periodStartDate
				? new Date(Math.max(occStart.getTime(), periodStartDate.getTime()))
				: occStart;
			const effectiveEnd = periodEndDate
				? new Date(Math.min(occEnd.getTime(), periodEndDate.getTime()))
				: occEnd;

			const durationHours =
				Math.max(0, effectiveEnd.getTime() - effectiveStart.getTime()) /
				3600000;
			periodScheduledTime += durationHours;
		}

		userReports.reports.push({
			id: u.id,
			name: u.name,
			username: u.username,
			periodScheduledTime,
			pastScheduledTime,
			pastAttendedTime,
			pastMissedTime,
			pastAttendancePercentage:
				pastScheduledTime > 0
					? (pastAttendedTime / pastScheduledTime) * 100
					: 0,
		});
	}

	// Add total count
	userReports.total = userReports.reports.length;

	return userReports;
}
