import { prisma } from "@ecehive/prisma";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZShiftUsersSchema = z.object({
	periodId: z.number().min(1),
	shiftTypeIds: z.array(z.number().min(1)).optional(),
	dayOfWeek: z.number().min(0).max(6).optional(),
	startTime: z.string().optional(), // HH:mm format
	endTime: z.string().optional(), // HH:mm format
});

export type TShiftUsersSchema = z.infer<typeof ZShiftUsersSchema>;

export type TShiftUsersOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TShiftUsersSchema;
};

export async function shiftUsersHandler(options: TShiftUsersOptions) {
	const { periodId, shiftTypeIds, dayOfWeek, startTime, endTime } =
		options.input;

	// Build the where clause
	const where: {
		shiftType: { periodId: number; id?: { in: number[] } };
		dayOfWeek?: number;
		startTime?: { gte?: string; lte?: string };
		endTime?: { gte?: string; lte?: string };
	} = {
		shiftType: { periodId },
	};

	if (shiftTypeIds && shiftTypeIds.length > 0) {
		where.shiftType.id = { in: shiftTypeIds };
	}

	if (dayOfWeek !== undefined) {
		where.dayOfWeek = dayOfWeek;
	}

	// Time range filtering - find shifts that overlap with the specified time range
	// A shift overlaps if: shift.startTime < filter.endTime AND shift.endTime > filter.startTime
	if (startTime) {
		where.endTime = { ...where.endTime, gte: startTime };
	}
	if (endTime) {
		where.startTime = { ...where.startTime, lte: endTime };
	}

	// Fetch all schedules with users
	const schedules = await prisma.shiftSchedule.findMany({
		where,
		include: {
			shiftType: {
				select: {
					id: true,
					name: true,
				},
			},
			users: {
				select: {
					id: true,
					name: true,
					username: true,
					email: true,
				},
				orderBy: { name: "asc" },
			},
		},
	});

	// Aggregate users across all matching schedules
	const userMap = new Map<
		number,
		{
			id: number;
			name: string;
			username: string;
			email: string;
			shiftCount: number;
			shiftTypes: Set<string>;
		}
	>();

	for (const schedule of schedules) {
		for (const user of schedule.users) {
			const existing = userMap.get(user.id);
			if (existing) {
				existing.shiftCount += 1;
				existing.shiftTypes.add(schedule.shiftType.name);
			} else {
				userMap.set(user.id, {
					id: user.id,
					name: user.name,
					username: user.username,
					email: user.email,
					shiftCount: 1,
					shiftTypes: new Set([schedule.shiftType.name]),
				});
			}
		}
	}

	// Convert to array and format
	const reports = Array.from(userMap.values())
		.map((user) => ({
			id: user.id,
			name: user.name,
			username: user.username,
			email: user.email,
			shiftCount: user.shiftCount,
			shiftTypes: Array.from(user.shiftTypes).join(", "),
		}))
		.sort((a, b) => a.name.localeCompare(b.name));

	return { reports };
}
