import {
	computeOccurrenceEnd,
	computeOccurrenceStart,
	isArrivalLate,
	isProtectedAttendanceStatus,
	PROTECTED_ATTENDANCE_STATUSES,
} from "@ecehive/features";
import { getLogger } from "@ecehive/logger";
import type { Prisma } from "@ecehive/prisma";
import { prisma } from "@ecehive/prisma";
import { CronJob } from "cron";

const logger = getLogger("workers:shift-attendance");

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

		// Get all active staffing sessions (only staffing sessions track attendance)
		const activeSessions = await prisma.session.findMany({
			where: {
				endedAt: null,
				sessionType: "staffing",
			},
			select: { userId: true, startedAt: true },
		});

		const userIds = Array.from(new Set(activeSessions.map((s) => s.userId)));

		// Create attendance records for all assigned users when shifts start.
		// Pass active sessions so users with active staffing sessions get "present"
		// records directly, avoiding the race condition where they'd briefly be "absent".
		await createAttendancesForOccurrenceStarts(now, activeSessions);

		// Process user-specific attendance updates only if there are active sessions.
		// These run sequentially after createAttendancesForOccurrenceStarts to avoid
		// race conditions: "absent" records must exist before they can be updated to "present".
		// closeAttendancesForRecentEnds can run in parallel with the "present" updates
		// since they operate on different attendance records (ones with timeIn vs without).
		if (activeSessions.length > 0) {
			await createAttendancesForRecentStarts(
				activeSessions,
				userIds,
				startWindow,
				now,
			);
			await Promise.all([
				closeAttendancesForRecentEnds(activeSessions, userIds, endWindow, now),
				ensureOngoingOccurrenceAttendances(activeSessions, userIds, now),
			]);
		}

		// Close any orphaned attendance records (present with timeIn but no timeOut)
		// for shifts that have already ended. This is a safety net for records missed
		// by the narrow real-time window or by sessions that were ended without
		// proper attendance handling.
		await closeOrphanedAttendances(now);
	} catch (err) {
		logger.error("Failed to update shift attendance", {
			error: err instanceof Error ? err.message : String(err),
		});
		throw err; // Re-throw to allow monitoring/alerting
	}
}

/**
 * Create attendance records for all assigned users when occurrences start.
 * Users with active staffing sessions get "present" status with timeIn directly.
 * Users without an active session get "absent" status.
 * Also handles past occurrences that may have been missed (e.g., if the worker didn't run).
 */
async function createAttendancesForOccurrenceStarts(
	now: Date,
	activeSessions: ActiveSession[],
): Promise<void> {
	// Build a map of userId -> session for quick lookup
	const activeSessionsByUserId = new Map(
		activeSessions.map((s) => [s.userId, s]),
	);
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
		const occStart = computeOccurrenceStart(
			new Date(occurrence.timestamp),
			occurrence.shiftSchedule.startTime,
		);
		const occEnd = computeOccurrenceEnd(
			occStart,
			occurrence.shiftSchedule.startTime,
			occurrence.shiftSchedule.endTime,
		);

		// Only process occurrences that have started
		// Skip occurrences that haven't started yet or ended more than a day ago
		if (occStart > now || occEnd < lookbackTime) continue;

		// Map existing attendances by userId for status checking
		const existingAttendancesMap = new Map(
			occurrence.attendances.map((a) => [a.userId, a]),
		);

		// Create attendance records for all assigned users who don't have one yet
		for (const user of occurrence.users) {
			const existingAttendance = existingAttendancesMap.get(user.id);

			// Skip if attendance already exists
			if (existingAttendance) {
				// If attendance exists with "upcoming" status and shift has started,
				// it will be transitioned to "absent" in a separate query below
				continue;
			}

			// Check if user has an active staffing session - if so, mark as "present"
			// directly to avoid a race where the record is briefly "absent"
			const activeSession = activeSessionsByUserId.get(user.id);
			if (activeSession) {
				const timeIn =
					activeSession.startedAt > occStart
						? activeSession.startedAt
						: occStart;
				const didArriveLate = isArrivalLate(occStart, timeIn);
				attendancesToCreate.push({
					shiftOccurrenceId: occurrence.id,
					userId: user.id,
					status: "present",
					timeIn,
					didArriveLate,
				});
			} else {
				// No active session - create with "absent" status
				attendancesToCreate.push({
					shiftOccurrenceId: occurrence.id,
					userId: user.id,
					status: "absent",
					timeIn: null,
					timeOut: null,
				});
			}
		}
	}

	// Batch create attendances
	if (attendancesToCreate.length > 0) {
		await prisma.shiftAttendance.createMany({
			data: attendancesToCreate,
			skipDuplicates: true,
		});
	}

	// Update any "upcoming" attendances for shifts that have started.
	// Users with active staffing sessions go to "present" with timeIn.
	// Users without an active session go to "absent".
	const upcomingAttendances = await prisma.shiftAttendance.findMany({
		where: {
			status: "upcoming",
			timeIn: null, // Only if user hasn't tapped in
		},
		include: {
			shiftOccurrence: {
				include: {
					shiftSchedule: {
						select: {
							startTime: true,
						},
					},
				},
			},
		},
	});

	const attendanceIdsToMarkAbsent: number[] = [];
	const attendancesToMarkPresent: Array<{
		id: number;
		timeIn: Date;
		didArriveLate: boolean;
	}> = [];

	for (const attendance of upcomingAttendances) {
		const occStart = computeOccurrenceStart(
			new Date(attendance.shiftOccurrence.timestamp),
			attendance.shiftOccurrence.shiftSchedule.startTime,
		);
		if (occStart > now) continue;

		const activeSession = activeSessionsByUserId.get(attendance.userId);
		if (activeSession) {
			const timeIn =
				activeSession.startedAt > occStart ? activeSession.startedAt : occStart;
			const didArriveLate = isArrivalLate(occStart, timeIn);
			attendancesToMarkPresent.push({
				id: attendance.id,
				timeIn,
				didArriveLate,
			});
		} else {
			attendanceIdsToMarkAbsent.push(attendance.id);
		}
	}

	if (attendanceIdsToMarkAbsent.length > 0) {
		await prisma.shiftAttendance.updateMany({
			where: {
				id: { in: attendanceIdsToMarkAbsent },
			},
			data: {
				status: "absent",
			},
		});
	}

	for (const update of attendancesToMarkPresent) {
		await prisma.shiftAttendance.update({
			where: { id: update.id },
			data: {
				status: "present",
				timeIn: update.timeIn,
				didArriveLate: update.didArriveLate,
			},
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
				select: {
					id: true,
					userId: true,
					timeIn: true,
					timeOut: true,
					status: true,
				},
			},
		},
	});

	const attendancesToCreate: Prisma.ShiftAttendanceCreateManyInput[] = [];
	const attendancesToUpdate: Array<{
		id: number;
		timeIn: Date;
		didArriveLate: boolean;
	}> = [];

	for (const occurrence of recentOccurrences) {
		const scheduledStart = computeOccurrenceStart(
			new Date(occurrence.timestamp),
			occurrence.shiftSchedule.startTime,
		);
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
				if (isProtectedAttendanceStatus(existingAttendance.status)) {
					continue;
				}
				// If attendance exists and doesn't have timeIn yet (was created as "absent"),
				// update it to "present" with timeIn
				if (!existingAttendance.timeIn && !existingAttendance.timeOut) {
					const timeIn =
						session.startedAt > scheduledStart
							? session.startedAt
							: scheduledStart;
					const didArriveLate = isArrivalLate(scheduledStart, timeIn);
					attendancesToUpdate.push({
						id: existingAttendance.id,
						timeIn,
						didArriveLate,
					});
				}
				// If timeIn or timeOut exists, skip (preserve first tap-in)
				continue;
			}

			// Create new attendance if none exists
			const timeIn =
				session.startedAt > scheduledStart ? session.startedAt : scheduledStart;
			const didArriveLate = isArrivalLate(scheduledStart, timeIn);

			attendancesToCreate.push({
				shiftOccurrenceId: occurrence.id,
				userId: session.userId,
				status: "present",
				timeIn,
				didArriveLate,
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
				didArriveLate: update.didArriveLate,
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
				select: { id: true, userId: true, status: true },
			},
		},
	});

	const activeSessionUserIds = new Set(activeSessions.map((s) => s.userId));
	const attendanceUpdates: Array<{
		id: number;
		timeOut: Date;
		didLeaveEarly: boolean;
	}> = [];

	for (const occurrence of occurrences) {
		const scheduledStart = computeOccurrenceStart(
			new Date(occurrence.timestamp),
			occurrence.shiftSchedule.startTime,
		);
		const occEnd = computeOccurrenceEnd(
			scheduledStart,
			occurrence.shiftSchedule.startTime,
			occurrence.shiftSchedule.endTime,
		);

		// Only process occurrences that ended in our window
		if (occEnd < window.start || occEnd > window.end) {
			continue;
		}

		for (const attendance of occurrence.attendances) {
			if (isProtectedAttendanceStatus(attendance.status)) continue;
			// Only close attendance if user still has an active session
			// (they were present when shift ended)
			if (activeSessionUserIds.has(attendance.userId)) {
				attendanceUpdates.push({
					id: attendance.id,
					timeOut: occEnd,
					didLeaveEarly: false,
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
				status: { notIn: PROTECTED_ATTENDANCE_STATUSES },
			},
			data: {
				timeOut: update.timeOut,
				didLeaveEarly: update.didLeaveEarly,
			},
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
	const lookbackMs = 24 * 60 * 60 * 1000;
	const lookbackTime = new Date(now.getTime() - lookbackMs);

	const ongoingOccurrences = await prisma.shiftOccurrence.findMany({
		where: {
			timestamp: { gte: lookbackTime, lte: now },
			users: { some: { id: { in: userIds } } },
		},
		include: {
			shiftSchedule: true,
			users: { select: { id: true } },
			attendances: {
				select: {
					id: true,
					userId: true,
					timeIn: true,
					timeOut: true,
					status: true,
				},
			},
		},
	});

	const attendancesToCreate: Prisma.ShiftAttendanceCreateManyInput[] = [];
	const attendancesToUpdate: Array<{
		id: number;
		timeIn: Date;
		didArriveLate: boolean;
	}> = [];

	for (const occurrence of ongoingOccurrences) {
		const scheduledStart = computeOccurrenceStart(
			new Date(occurrence.timestamp),
			occurrence.shiftSchedule.startTime,
		);
		const occEnd = computeOccurrenceEnd(
			scheduledStart,
			occurrence.shiftSchedule.startTime,
			occurrence.shiftSchedule.endTime,
		);

		// Skip if occurrence is not currently ongoing
		if (!(scheduledStart <= now && occEnd > now)) continue;

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
				if (isProtectedAttendanceStatus(existingAttendance.status)) {
					continue;
				}
				// If attendance exists and doesn't have timeIn yet (was created as "absent"),
				// update it to "present" with timeIn
				if (!existingAttendance.timeIn && !existingAttendance.timeOut) {
					const timeIn =
						session.startedAt > scheduledStart
							? session.startedAt
							: scheduledStart;
					const didArriveLate = isArrivalLate(scheduledStart, timeIn);
					attendancesToUpdate.push({
						id: existingAttendance.id,
						timeIn,
						didArriveLate,
					});
				}
				// If timeIn or timeOut exists, skip (preserve first tap-in)
				continue;
			}

			// Create new attendance if none exists
			const timeIn =
				session.startedAt > scheduledStart ? session.startedAt : scheduledStart;
			const didArriveLate = isArrivalLate(scheduledStart, timeIn);

			attendancesToCreate.push({
				shiftOccurrenceId: occurrence.id,
				userId: session.userId,
				status: "present",
				timeIn,
				didArriveLate,
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
				didArriveLate: update.didArriveLate,
			},
		});
	}
}

/**
 * Close orphaned attendance records where the shift has ended but timeOut was never set.
 * This catches records missed by the narrow real-time window in closeAttendancesForRecentEnds,
 * or records left open due to the endOldSessions worker previously bypassing attendance handling.
 * Only processes "present" records that have a timeIn (user actually attended).
 */
async function closeOrphanedAttendances(now: Date): Promise<void> {
	const LOOKBACK_MS = 24 * 60 * 60 * 1000;
	const lookbackTime = new Date(now.getTime() - LOOKBACK_MS);

	const orphanedAttendances = await prisma.shiftAttendance.findMany({
		where: {
			status: "present",
			timeIn: { not: null },
			timeOut: null,
			shiftOccurrence: {
				timestamp: {
					gte: lookbackTime,
					lte: now,
				},
			},
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

	for (const attendance of orphanedAttendances) {
		if (isProtectedAttendanceStatus(attendance.status)) continue;

		const scheduledStart = computeOccurrenceStart(
			new Date(attendance.shiftOccurrence.timestamp),
			attendance.shiftOccurrence.shiftSchedule.startTime,
		);
		const occEnd = computeOccurrenceEnd(
			scheduledStart,
			attendance.shiftOccurrence.shiftSchedule.startTime,
			attendance.shiftOccurrence.shiftSchedule.endTime,
		);

		// Only close if the shift has already ended
		if (occEnd >= now) continue;

		await prisma.shiftAttendance.updateMany({
			where: {
				id: attendance.id,
				timeOut: null,
				status: { notIn: PROTECTED_ATTENDANCE_STATUSES },
			},
			data: {
				timeOut: occEnd,
				didLeaveEarly: false,
			},
		});
	}
}

export const updateShiftAttendanceJob = new CronJob(
	"*/1 * * * *",
	updateShiftAttendance,
);
