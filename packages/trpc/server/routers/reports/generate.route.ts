import { type Prisma, prisma } from "@ecehive/prisma";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZGenerateSchema = z.object({
	startDate: z.string().optional(),
	endDate: z.string().optional(),
	staffingRoleId: z.number(),
});

export type TGenerateSchema = z.infer<typeof ZGenerateSchema>;

export type TGenerateOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TGenerateSchema;
};

export async function generateHandler(options: TGenerateOptions) {
	const { staffingRoleId, startDate, endDate } = options.input;

	const where: Prisma.ShiftAttendanceWhereInput = {
		user: {
			roles: {
				some: {
					id: staffingRoleId,
				},
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
			const whereMutable = where as unknown as {
				shiftOccurrence?: { timestamp?: Prisma.DateTimeFilter };
			};
			whereMutable.shiftOccurrence = { timestamp: timestampFilter };
		}
	}

	const shiftAttendances = await prisma.shiftAttendance.findMany({
		where: where,
		include: {
			user: true,
		},
		orderBy: {
			user: { username: "asc" },
		},
	});

	// Aggregate shiftAttendances by username
	const userMap = new Map<
		string,
		{
			id: number;
			username: string;
			name: string;
			shiftAttendances: {
				id: number;
				status: string;
				timeIn: Date | null;
				timeOut: Date | null;
			}[];
		}
	>();

	shiftAttendances.forEach((attendance) => {
		const username = attendance.user.username;
		if (!userMap.has(username)) {
			userMap.set(username, {
				id: attendance.user.id,
				username: username,
				name: attendance.user.name,
				shiftAttendances: [
					{
						id: attendance.id,
						status: attendance.status,
						timeIn: attendance.timeIn,
						timeOut: attendance.timeOut,
					},
				],
			});
		} else {
			userMap.get(username)?.shiftAttendances.push({
				id: attendance.id,
				status: attendance.status,
				timeIn: attendance.timeIn,
				timeOut: attendance.timeOut,
			});
		}
	});

	const userReports: {
		reports: {
			id: number;
			name: string;
			username: string;
			totalScheduledTime: number;
			totalAttendedTime: number;
			totalMissedTime: number;
			attendancePercentage: number;
		}[];
		total: number;
	} = { reports: [], total: 0 };

	userMap.forEach((user) => {
		const totalScheduledTime = user.shiftAttendances.reduce(
			(acc, attendance) => {
				if (attendance.timeIn && attendance.timeOut) {
					return (
						acc + (attendance.timeOut.getTime() - attendance.timeIn.getTime())
					);
				}
				return acc;
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
						acc + (attendance.timeOut.getTime() - attendance.timeIn.getTime())
					);
				}
				return acc;
			},
			0,
		);

		const totalMissedTime = totalScheduledTime - totalAttendedTime;
		const attendancePercentage =
			totalScheduledTime > 0
				? (totalAttendedTime / totalScheduledTime) * 100
				: 0;

		userReports.reports.push({
			id: user.id,
			name: user.name,
			username: user.username,
			totalScheduledTime,
			totalAttendedTime,
			totalMissedTime,
			attendancePercentage,
		});
	});

	// Add total count
	userReports.total = userReports.reports.length;

	return userReports;
}
