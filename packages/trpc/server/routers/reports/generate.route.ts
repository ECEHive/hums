import { type Prisma, prisma } from "@ecehive/prisma";
import { DateTimeFieldRefInput } from "@ecehive/prisma/generated/prisma/internal/prismaNamespace";
import z from "zod";
import { id } from "zod/v4/locales";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZListSchema = z.object({
	limit: z.number().min(1).max(100).optional(),
	offset: z.number().min(0).optional(),
	staffingRoleId: z.number(),
});

export type TListSchema = z.infer<typeof ZListSchema>;

export type TListOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TListSchema;
};

export async function generateHandler(options: TListOptions) {
	const { staffingRoleId, limit = 20, offset = 0 } = options.input;

	const whereStaffing: Prisma.ShiftAttendanceWhereInput = {
		user: {
			roles: {
				some: {
					id: staffingRoleId,
				},
			},
		},
	};

	const [shiftAttendances, total] = await Promise.all([
		prisma.shiftAttendance.findMany({
			where: whereStaffing,
			include: {
				user: true,
			},
			orderBy: { userId: "asc" },
			skip: offset,
			take: limit,
		}),
		prisma.shiftAttendance.count({ where: whereStaffing }),
	]);

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
