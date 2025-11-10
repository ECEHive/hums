import { TZDate } from "@date-fns/tz";
import { env } from "@ecehive/env";
import { prisma } from "@ecehive/prisma";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZListMySchema = z.object({
	periodId: z.number().min(1),
	limit: z.number().min(1).max(100).optional(),
	offset: z.number().min(0).optional(),
});

export type TListMySchema = z.infer<typeof ZListMySchema>;

export type TListMyOptions = {
	ctx: TPermissionProtectedProcedureContext;
	input: TListMySchema;
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
 * List shift occurrences for the current user in a specific period
 */
export async function listMyHandler(options: TListMyOptions) {
	const { periodId, limit = 50, offset = 0 } = options.input;
	const userId = options.ctx.userId;

	const now = new Date();

	// Check if user has an active session
	const activeSession = await prisma.session.findFirst({
		where: {
			userId,
			endedAt: null,
		},
		select: { id: true },
	});

	const hasActiveSession = !!activeSession;

	// Get all shift occurrences for the user in this period
	const [occurrences, total] = await Promise.all([
		prisma.shiftOccurrence.findMany({
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
				timestamp: "asc",
			},
			skip: offset,
			take: limit,
		}),
		prisma.shiftOccurrence.count({
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
			},
		}),
	]);

	// Map to a cleaner format
	const mappedOccurrences = occurrences.map((occ) => {
		const occStart = new Date(occ.timestamp);
		const occEnd = computeOccurrenceEnd(
			occStart,
			occ.shiftSchedule.startTime,
			occ.shiftSchedule.endTime,
		);

		const isActive = occStart <= now && occEnd > now;
		const isTappedIn = isActive && hasActiveSession;

		return {
			id: occ.id,
			timestamp: occ.timestamp,
			slot: occ.slot,
			shiftScheduleId: occ.shiftScheduleId,
			shiftTypeName: occ.shiftSchedule.shiftType.name,
			shiftTypeLocation: occ.shiftSchedule.shiftType.location,
			shiftTypeColor: occ.shiftSchedule.shiftType.color,
			startTime: occ.shiftSchedule.startTime,
			endTime: occ.shiftSchedule.endTime,
			dayOfWeek: occ.shiftSchedule.dayOfWeek,
			users: occ.users,
			attendance: occ.attendances[0] || null,
			isActive,
			isTappedIn,
		};
	});

	return {
		occurrences: mappedOccurrences,
		total,
	};
}
