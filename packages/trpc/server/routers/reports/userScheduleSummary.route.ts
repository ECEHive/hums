import { prisma } from "@ecehive/prisma";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZUserScheduleSummarySchema = z.object({
	periodId: z.number().min(1),
	shiftTypeIds: z.array(z.number().min(1)).optional(),
});

export type TUserScheduleSummarySchema = z.infer<
	typeof ZUserScheduleSummarySchema
>;

export type TUserScheduleSummaryOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TUserScheduleSummarySchema;
};

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function timeToHours(startTime: string, endTime: string): number {
	const [startHours, startMinutes] = startTime.split(":").map(Number);
	const [endHours, endMinutes] = endTime.split(":").map(Number);

	const startTotalMinutes = startHours * 60 + startMinutes;
	let endTotalMinutes = endHours * 60 + endMinutes;

	// Handle overnight shifts (end time is earlier than start time)
	if (endTotalMinutes < startTotalMinutes) {
		endTotalMinutes += 24 * 60;
	} else if (endTotalMinutes === startTotalMinutes) {
		// Zero-duration shift (start and end at same time) - return 0 hours
		return 0;
	}

	return (endTotalMinutes - startTotalMinutes) / 60;
}

export async function userScheduleSummaryHandler(
	options: TUserScheduleSummaryOptions,
) {
	const { periodId, shiftTypeIds } = options.input;

	// Build the where clause
	const where: {
		shiftType: { periodId: number; id?: { in: number[] } };
	} = {
		shiftType: { periodId },
	};

	if (shiftTypeIds && shiftTypeIds.length > 0) {
		where.shiftType.id = { in: shiftTypeIds };
	}

	// Fetch all schedules with users
	const schedules = await prisma.shiftSchedule.findMany({
		where,
		include: {
			shiftType: {
				select: {
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
			},
		},
	});

	// Build user summary map
	const userSummaryMap = new Map<
		number,
		{
			id: number;
			name: string;
			username: string;
			email: string;
			totalScheduledHours: number;
			shiftsPerWeek: number;
			shiftTypes: Set<string>;
			daysScheduled: Set<number>;
		}
	>();

	for (const schedule of schedules) {
		const hours = timeToHours(schedule.startTime, schedule.endTime);

		for (const user of schedule.users) {
			const existing = userSummaryMap.get(user.id);
			if (existing) {
				existing.totalScheduledHours += hours;
				existing.shiftsPerWeek += 1;
				existing.shiftTypes.add(schedule.shiftType.name);
				existing.daysScheduled.add(schedule.dayOfWeek);
			} else {
				userSummaryMap.set(user.id, {
					id: user.id,
					name: user.name,
					username: user.username,
					email: user.email,
					totalScheduledHours: hours,
					shiftsPerWeek: 1,
					shiftTypes: new Set([schedule.shiftType.name]),
					daysScheduled: new Set([schedule.dayOfWeek]),
				});
			}
		}
	}

	// Convert to array and format
	const reports = Array.from(userSummaryMap.values())
		.map((summary) => ({
			id: summary.id,
			name: summary.name,
			username: summary.username,
			email: summary.email,
			totalScheduledHours: Math.round(summary.totalScheduledHours * 100) / 100,
			shiftsPerWeek: summary.shiftsPerWeek,
			shiftTypes: Array.from(summary.shiftTypes).sort(),
			daysScheduled: Array.from(summary.daysScheduled)
				.sort((a, b) => a - b)
				.map((d) => DAYS_OF_WEEK[d]),
		}))
		.sort((a, b) => a.username.localeCompare(b.username));

	return {
		reports,
		total: reports.length,
	};
}
