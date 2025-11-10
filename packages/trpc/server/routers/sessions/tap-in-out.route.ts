import { TZDate } from "@date-fns/tz";
import { env } from "@ecehive/env";
import { findUserByCard } from "@ecehive/features";
import type { Prisma } from "@ecehive/prisma";
import { prisma } from "@ecehive/prisma";
import z from "zod";
import type { TKioskProtectedProcedureContext } from "../../trpc";

export const ZTapInOutSchema = z.object({
	cardNumber: z.string().regex(/^\d+$/),
});

export type TTapInOutSchema = z.infer<typeof ZTapInOutSchema>;

export type TTapInOutOptions = {
	ctx: TKioskProtectedProcedureContext;
	input: TTapInOutSchema;
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
 * Find active shift occurrences for a user at the current time
 */
async function findActiveShiftOccurrences(
	tx: Prisma.TransactionClient,
	userId: number,
	now: Date,
) {
	const occurrences = await tx.shiftOccurrence.findMany({
		where: {
			users: {
				some: { id: userId },
			},
			timestamp: {
				lte: now,
			},
		},
		include: {
			shiftSchedule: {
				select: {
					startTime: true,
					endTime: true,
				},
			},
			attendances: {
				where: { userId },
				select: {
					id: true,
					timeIn: true,
					timeOut: true,
				},
			},
		},
	});

	// Filter to only occurrences that are currently active
	const activeOccurrences = occurrences.filter((occ) => {
		const occStart = new Date(occ.timestamp);
		const occEnd = computeOccurrenceEnd(
			occStart,
			occ.shiftSchedule.startTime,
			occ.shiftSchedule.endTime,
		);
		return occStart <= now && occEnd > now;
	});

	return activeOccurrences;
}

/**
 * Create or update attendance records when user taps in
 * Updates existing "absent" records (with no timeIn) to "present"
 */
async function handleTapInAttendance(
	tx: Prisma.TransactionClient,
	userId: number,
	tapInTime: Date,
) {
	const activeOccurrences = await findActiveShiftOccurrences(
		tx,
		userId,
		tapInTime,
	);

	for (const occurrence of activeOccurrences) {
		const existingAttendance = occurrence.attendances[0];

		if (existingAttendance) {
			// If attendance exists but doesn't have a timeIn yet (was created as "absent"),
			// update it to "present" with timeIn
			if (!existingAttendance.timeIn && !existingAttendance.timeOut) {
				const occStart = new Date(occurrence.timestamp);
				const timeIn = tapInTime > occStart ? tapInTime : occStart;

				await tx.shiftAttendance.update({
					where: { id: existingAttendance.id },
					data: {
						status: "present",
						timeIn,
					},
				});
			}
			// If timeIn or timeOut already exists, skip (preserve first tap-in)
			continue;
		}

		// Create new attendance record if none exists
		const occStart = new Date(occurrence.timestamp);
		const timeIn = tapInTime > occStart ? tapInTime : occStart;

		await tx.shiftAttendance.create({
			data: {
				shiftOccurrenceId: occurrence.id,
				userId,
				status: "present",
				timeIn,
			},
		});
	}
}

/**
 * Update attendance records when user taps out
 * Only updates attendances that don't already have a timeOut (first tap-out only)
 */
async function handleTapOutAttendance(
	tx: Prisma.TransactionClient,
	userId: number,
	tapOutTime: Date,
) {
	// Find all attendances without timeOut for this user
	// This ensures we only record the first tap-out
	const openAttendances = await tx.shiftAttendance.findMany({
		where: {
			userId,
			timeOut: null,
		},
		include: {
			shiftOccurrence: {
				include: {
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

	for (const attendance of openAttendances) {
		const occStart = new Date(attendance.shiftOccurrence.timestamp);
		const occEnd = computeOccurrenceEnd(
			occStart,
			attendance.shiftOccurrence.shiftSchedule.startTime,
			attendance.shiftOccurrence.shiftSchedule.endTime,
		);

		// Only close attendance if the shift is still active or just ended
		// Use the earlier of tapOutTime or occEnd
		const timeOut = tapOutTime < occEnd ? tapOutTime : occEnd;

		// Record the first tap-out time only
		await tx.shiftAttendance.update({
			where: { id: attendance.id },
			data: { timeOut },
		});
	}
}

export async function tapInOutHandler(options: TTapInOutOptions) {
	const { cardNumber } = options.input;

	const user = await findUserByCard(cardNumber);

	return await prisma.$transaction(async (tx) => {
		const now = new Date();

		// Get the most recent session for the user
		const mostRecentSession = await tx.session.findFirst({
			where: { userId: user.id },
			orderBy: { startedAt: "desc" },
		});

		// If there is no session, or the most recent session has an endedAt, create a new session (tap in)
		if (!mostRecentSession || mostRecentSession.endedAt) {
			const session = await tx.session.create({
				data: {
					userId: user.id,
					startedAt: now,
				},
			});

			// Handle attendance for active shifts
			await handleTapInAttendance(tx, user.id, now);

			return {
				status: "tapped_in",
				user,
				session,
			};
		}

		// Otherwise, update the most recent session to set endedAt (tap out)
		const session = await tx.session.update({
			where: { id: mostRecentSession.id },
			data: { endedAt: now },
		});

		// Handle attendance for active shifts
		await handleTapOutAttendance(tx, user.id, now);

		return {
			status: "tapped_out",
			user,
			session,
		};
	});
}
