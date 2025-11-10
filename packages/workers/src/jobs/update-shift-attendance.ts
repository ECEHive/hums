import { computeOccurrenceEnd } from "@ecehive/features";
import type { Prisma } from "@ecehive/prisma";
import { prisma } from "@ecehive/prisma";
import { CronJob } from "cron";

interface ActiveSession {
	userId: number;
	startedAt: Date;
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

		const userIds = Array.from(new Set(activeSessions.map((s) => s.userId)));

		// Create attendance records for all assigned users when shifts start
		// This runs regardless of whether there are active sessions
		await createAttendancesForOccurrenceStarts(now);

		// Process user-specific attendance updates only if there are active sessions
		if (activeSessions.length > 0) {
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
		}
	} catch (err) {
		console.error("updateShiftAttendance error:", err);
		throw err; // Re-throw to allow monitoring/alerting
	}
}

/**
 * Create attendance records for all assigned users when occurrences start
 * Creates "absent" status by default for all assigned users
 * This ensures every shift has attendance records, which can be updated to "present" when users tap in
 * Also handles past occurrences that may have been missed (e.g., if the worker didn't run)
 */
async function createAttendancesForOccurrenceStarts(now: Date): Promise<void> {
	// Find all occurrences that started within the window OR are currently ongoing
	// This ensures we catch any missed occurrences from previous runs
	const LOOKBACK_DAYS = 1; // Look back 1 day to catch any missed occurrences
	const lookbackTime = new Date(
		now.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
	);

	const recentOccurrences = await prisma.shiftOccurrence.findMany({
		where: {
			timestamp: {
				gte: lookbackTime, // Start from lookback time
				lte: now, // Only process occurrences that have started
			},
		},
		include: {
			shiftSchedule: true,
			users: { select: { id: true } },
			attendances: { select: { id: true, userId: true } },
		},
	});

	const attendancesToCreate: Prisma.ShiftAttendanceCreateManyInput[] = [];

	for (const occurrence of recentOccurrences) {
		const occStart = new Date(occurrence.timestamp);
		const occEnd = computeOccurrenceEnd(
			occStart,
			occurrence.shiftSchedule.startTime,
			occurrence.shiftSchedule.endTime,
		);

		// Only process occurrences that have started
		// Skip occurrences that haven't started yet or ended more than a day ago
		if (occStart > now || occEnd < lookbackTime) continue;

		const existingAttendanceUserIds = new Set(
			occurrence.attendances.map((a) => a.userId),
		);

		// Create attendance records for all assigned users who don't have one yet
		for (const user of occurrence.users) {
			// Skip if attendance already exists
			if (existingAttendanceUserIds.has(user.id)) continue;

			// Create attendance with "absent" status by default
			// This will be updated to "present" if the user has an active session
			attendancesToCreate.push({
				shiftOccurrenceId: occurrence.id,
				userId: user.id,
				status: "absent",
				timeIn: null,
				timeOut: null,
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
 * Create attendance records for shift occurrences that recently started
 * Updates existing "absent" records to "present" when users have active sessions
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
			attendances: {
				select: { id: true, userId: true, timeIn: true, timeOut: true },
			},
		},
	});

	const attendancesToCreate: Prisma.ShiftAttendanceCreateManyInput[] = [];
	const attendancesToUpdate: Array<{ id: number; timeIn: Date }> = [];

	for (const occurrence of recentOccurrences) {
		const occStart = new Date(occurrence.timestamp);
		const assignedUserIds = new Set(occurrence.users.map((u) => u.id));

		// Map existing attendances by userId
		const existingAttendances = new Map(
			occurrence.attendances.map((a) => [a.userId, a]),
		);

		for (const session of activeSessions) {
			// Skip if user is not assigned to this occurrence
			if (!assignedUserIds.has(session.userId)) continue;

			const existingAttendance = existingAttendances.get(session.userId);

			if (existingAttendance) {
				// If attendance exists and doesn't have timeIn yet (was created as "absent"),
				// update it to "present" with timeIn
				if (!existingAttendance.timeIn && !existingAttendance.timeOut) {
					const timeIn =
						session.startedAt > occStart ? session.startedAt : occStart;
					attendancesToUpdate.push({
						id: existingAttendance.id,
						timeIn,
					});
				}
				// If timeIn or timeOut exists, skip (preserve first tap-in)
				continue;
			}

			// Create new attendance if none exists
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

	// Batch create new attendances
	if (attendancesToCreate.length > 0) {
		await prisma.shiftAttendance.createMany({
			data: attendancesToCreate,
			skipDuplicates: true,
		});
	}

	// Update existing "absent" records to "present"
	for (const update of attendancesToUpdate) {
		await prisma.shiftAttendance.update({
			where: { id: update.id },
			data: {
				status: "present",
				timeIn: update.timeIn,
			},
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
 * Updates existing "absent" records to "present" when users have active sessions
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
			attendances: {
				select: { id: true, userId: true, timeIn: true, timeOut: true },
			},
		},
	});

	const attendancesToCreate: Prisma.ShiftAttendanceCreateManyInput[] = [];
	const attendancesToUpdate: Array<{ id: number; timeIn: Date }> = [];

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

		// Map existing attendances by userId
		const existingAttendances = new Map(
			occurrence.attendances.map((a) => [a.userId, a]),
		);

		for (const session of activeSessions) {
			// Skip if user is not assigned to this occurrence
			if (!assignedUserIds.has(session.userId)) continue;

			const existingAttendance = existingAttendances.get(session.userId);

			if (existingAttendance) {
				// If attendance exists and doesn't have timeIn yet (was created as "absent"),
				// update it to "present" with timeIn
				if (!existingAttendance.timeIn && !existingAttendance.timeOut) {
					const timeIn =
						session.startedAt > occStart ? session.startedAt : occStart;
					attendancesToUpdate.push({
						id: existingAttendance.id,
						timeIn,
					});
				}
				// If timeIn or timeOut exists, skip (preserve first tap-in)
				continue;
			}

			// Create new attendance if none exists
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

	// Batch create new attendances
	if (attendancesToCreate.length > 0) {
		await prisma.shiftAttendance.createMany({
			data: attendancesToCreate,
			skipDuplicates: true,
		});
	}

	// Update existing "absent" records to "present"
	for (const update of attendancesToUpdate) {
		await prisma.shiftAttendance.update({
			where: { id: update.id },
			data: {
				status: "present",
				timeIn: update.timeIn,
			},
		});
	}
}

export const updateShiftAttendanceJob = new CronJob(
	"*/1 * * * *",
	updateShiftAttendance,
);
