import { type Prisma, prisma } from "@ecehive/prisma";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZGenerateSchema = z.object({
	limit: z.number().min(1).max(100).optional(),
	offset: z.number().min(0).optional(),
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
	const {
		staffingRoleId,
		startDate,
		endDate,
		limit = 20,
		offset = 0,
	} = options.input;

	const where: Prisma.ShiftAttendanceWhereInput = {
		user: {
			roles: {
				some: {
					id: staffingRoleId,
				},
			},
		},
		...(startDate && endDate
			? {
					shift: {
						start: {
							gte: new Date(startDate),
						},
						end: {
							lte: new Date(endDate),
						},
					},
				}
			: {}),
	};

	const shiftAttendances = await prisma.shiftAttendance.findMany({
		where: where,
		include: {
			user: true,
		},
		orderBy: {
			user: { username: "asc" },
		},
		skip: offset,
		take: limit,
	});

	// Aggregate shiftAttendences by username
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
		id: number;
		name: string;
		username: string;
		totalScheduledTime: number;
		totalAttendedTime: number;
		totalMissedTime: number;
		attendancePercentage: number;
	}[] = [];

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
					attendance.status === "attended" &&
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

		userReports.push({
			id: user.id,
			name: user.name,
			username: user.username,
			totalScheduledTime,
			totalAttendedTime,
			totalMissedTime,
			attendancePercentage,
		});
	});

	return userReports;
}
