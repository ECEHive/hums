import { TZDate } from "@date-fns/tz";
import { env } from "@ecehive/env";
import type { Prisma } from "@ecehive/prisma";
import { prisma } from "@ecehive/prisma";
import { CronJob } from "cron";

interface TimeComponents {
	hours: number;
	minutes: number;
}

interface ActiveSession {
	userId: number;
	startedAt: Date;
}

/**
 * Parse time string in HH:MM:SS format to hours and minutes
 */
function parseTime(time: string): TimeComponents {
	const parts = time.split(":");
	return {
		hours: Number.parseInt(parts[0], 10),
		minutes: Number.parseInt(parts[1], 10),
	};
}

/**
 * Compute the end timestamp of a shift occurrence in the configured timezone
 * Handles shifts that wrap to the next day
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
 * Worker function that runs every minute to update shift attendance
 * based on active user sessions and shift occurrences
 */
async function updateShiftAttendance(): Promise<void> {
	try {
		const now = new Date();

		// Time windows to catch recent starts/ends (allow for small delays and clock drift)
		const LOOKBACK_MS = 90_000; // 90 seconds
		const LOOKAHEAD_MS = 30_000; // 30 seconds

		const startWindow = {
			start: new Date(now.getTime() - LOOKBACK_MS),
			end: new Date(now.getTime() + LOOKAHEAD_MS),
		};

		const endWindow = {
			start: new Date(now.getTime() - LOOKBACK_MS),
			end: new Date(now.getTime() + LOOKAHEAD_MS),
		};

		// Get all active sessions
		const activeSessions = await prisma.session.findMany({
			where: { endedAt: null },
			select: { userId: true, startedAt: true },
		});

		// Early return if no active sessions
		if (activeSessions.length === 0) {
			return;
		}

		const userIds = Array.from(new Set(activeSessions.map((s) => s.userId)));

		// Process in parallel for better performance
		await Promise.all([
			createAttendancesForRecentStarts(
				activeSessions,
				userIds,
				startWindow,
				now,
			),
			closeAttendancesForRecentEnds(activeSessions, userIds, endWindow, now),
			ensureOngoingOccurrenceAttendances(activeSessions, userIds, now),
		]);
	} catch (err) {
		console.error("updateShiftAttendance error:", err);
		throw err; // Re-throw to allow monitoring/alerting
	}
}

/**
 * Create attendance records for shift occurrences that recently started
 */
async function createAttendancesForRecentStarts(
	activeSessions: ActiveSession[],
	userIds: number[],
	window: { start: Date; end: Date },
	_now: Date,
): Promise<void> {
	const recentOccurrences = await prisma.shiftOccurrence.findMany({
		where: {
			timestamp: {
				gte: window.start,
				lte: window.end,
			},
			users: { some: { id: { in: userIds } } },
		},
		include: {
			shiftSchedule: true,
			users: { select: { id: true } },
			attendances: { select: { id: true, userId: true, timeOut: true } },
		},
	});

	const attendancesToCreate: Prisma.ShiftAttendanceCreateManyInput[] = [];

	for (const occurrence of recentOccurrences) {
		const occStart = new Date(occurrence.timestamp);
		const assignedUserIds = new Set(occurrence.users.map((u) => u.id));
		const existingAttendanceUserIds = new Set(
			occurrence.attendances.map((a) => a.userId),
		);

		for (const session of activeSessions) {
			// Skip if user is not assigned to this occurrence
			if (!assignedUserIds.has(session.userId)) continue;

			// Skip if attendance already exists (preserve first tap-in)
			if (existingAttendanceUserIds.has(session.userId)) continue;

			// Set timeIn based on when the user's session started
			const timeIn =
				session.startedAt > occStart ? session.startedAt : occStart;

			attendancesToCreate.push({
				shiftOccurrenceId: occurrence.id,
				userId: session.userId,
				status: "present",
				timeIn,
			});
		}
	}

	// Batch create attendances
	if (attendancesToCreate.length > 0) {
		await prisma.shiftAttendance.createMany({
			data: attendancesToCreate,
			skipDuplicates: true,
		});
	}
}

/**
 * Close attendance records for shift occurrences that recently ended
 * Only updates timeOut if the current value is null (preserves last tap-out)
 */
async function closeAttendancesForRecentEnds(
	activeSessions: ActiveSession[],
	userIds: number[],
	window: { start: Date; end: Date },
	_now: Date,
): Promise<void> {
	const OCCURRENCE_LOOKBACK_MS = 24 * 60 * 60 * 1000; // 24 hours

	const occurrences = await prisma.shiftOccurrence.findMany({
		where: {
			timestamp: {
				gte: new Date(window.start.getTime() - OCCURRENCE_LOOKBACK_MS),
				lte: window.end,
			},
			users: { some: { id: { in: userIds } } },
			attendances: {
				some: { timeOut: null },
			},
		},
		include: {
			shiftSchedule: true,
			attendances: {
				where: { timeOut: null },
				select: { id: true, userId: true },
			},
		},
	});

	const activeSessionUserIds = new Set(activeSessions.map((s) => s.userId));
	const attendanceUpdates: Array<{ id: number; timeOut: Date }> = [];

	for (const occurrence of occurrences) {
		const occStart = new Date(occurrence.timestamp);
		const occEnd = computeOccurrenceEnd(
			occStart,
			occurrence.shiftSchedule.startTime,
			occurrence.shiftSchedule.endTime,
		);

		// Only process occurrences that ended in our window
		if (occEnd < window.start || occEnd > window.end) {
			continue;
		}

		for (const attendance of occurrence.attendances) {
			// Only close attendance if user still has an active session
			// (they were present when shift ended)
			if (activeSessionUserIds.has(attendance.userId)) {
				attendanceUpdates.push({
					id: attendance.id,
					timeOut: occEnd,
				});
			}
		}
	}

	// Batch update attendances - only update if timeOut is still null
	// This preserves the last tap-out time if user tapped out before shift ended
	for (const update of attendanceUpdates) {
		await prisma.shiftAttendance.updateMany({
			where: {
				id: update.id,
				timeOut: null, // Only update if still null
			},
			data: { timeOut: update.timeOut },
		});
	}
}

/**
 * Ensure attendance records exist for all ongoing shift occurrences
 * This catches cases where a user starts a session mid-shift
 * Preserves first tap-in time if attendance already exists
 */
async function ensureOngoingOccurrenceAttendances(
	activeSessions: ActiveSession[],
	userIds: number[],
	now: Date,
): Promise<void> {
	const ongoingOccurrences = await prisma.shiftOccurrence.findMany({
		where: {
			timestamp: { lte: now },
			users: { some: { id: { in: userIds } } },
		},
		include: {
			shiftSchedule: true,
			users: { select: { id: true } },
			attendances: { select: { id: true, userId: true, timeOut: true } },
		},
	});

	const attendancesToCreate: Prisma.ShiftAttendanceCreateManyInput[] = [];

	for (const occurrence of ongoingOccurrences) {
		const occStart = new Date(occurrence.timestamp);
		const occEnd = computeOccurrenceEnd(
			occStart,
			occurrence.shiftSchedule.startTime,
			occurrence.shiftSchedule.endTime,
		);

		// Skip if occurrence is not currently ongoing
		if (!(occStart <= now && occEnd > now)) continue;

		const assignedUserIds = new Set(occurrence.users.map((u) => u.id));
		const existingAttendanceUserIds = new Set(
			occurrence.attendances.map((a) => a.userId),
		);

		for (const session of activeSessions) {
			// Skip if user is not assigned to this occurrence
			if (!assignedUserIds.has(session.userId)) continue;

			// Skip if attendance already exists (preserve first tap-in)
			if (existingAttendanceUserIds.has(session.userId)) continue;

			// Set timeIn based on when the user's session started
			const timeIn =
				session.startedAt > occStart ? session.startedAt : occStart;

			attendancesToCreate.push({
				shiftOccurrenceId: occurrence.id,
				userId: session.userId,
				status: "present",
				timeIn,
			});
		}
	}

	// Batch create attendances
	if (attendancesToCreate.length > 0) {
		await prisma.shiftAttendance.createMany({
			data: attendancesToCreate,
			skipDuplicates: true,
		});
	}
}

export const updateShiftAttendanceJob = new CronJob(
	"*/1 * * * *",
	updateShiftAttendance,
);
