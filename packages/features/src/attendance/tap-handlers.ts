import type { Prisma } from "@ecehive/prisma";
import {
	computeOccurrenceEnd,
	computeOccurrenceStart,
	isArrivalLate,
	isDepartureEarly,
} from "../time-utils";
import {
	isProtectedAttendanceStatus,
	PROTECTED_ATTENDANCE_STATUSES,
} from "./calculations";

/**
 * Find active shift occurrences for a user at the current time.
 * Limits the query to occurrences from the last 24 hours to avoid
 * scanning the entire history of shift occurrences.
 */
async function findActiveShiftOccurrences(
	tx: Prisma.TransactionClient,
	userId: number,
	now: Date,
) {
	const lookbackMs = 24 * 60 * 60 * 1000;
	const lookbackTime = new Date(now.getTime() - lookbackMs);

	const occurrences = await tx.shiftOccurrence.findMany({
		where: {
			users: {
				some: { id: userId },
			},
			timestamp: {
				gte: lookbackTime,
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
					status: true,
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
 * Create or update attendance records when user taps in.
 * Updates existing "absent" records (with no timeIn) to "present".
 */
export async function handleTapInAttendance(
	tx: Prisma.TransactionClient,
	userId: number,
	tapInTime: Date,
): Promise<void> {
	const activeOccurrences = await findActiveShiftOccurrences(
		tx,
		userId,
		tapInTime,
	);

	for (const occurrence of activeOccurrences) {
		const existingAttendance = occurrence.attendances[0];
		const scheduledStart = computeOccurrenceStart(
			new Date(occurrence.timestamp),
			occurrence.shiftSchedule.startTime,
		);

		if (existingAttendance) {
			if (isProtectedAttendanceStatus(existingAttendance.status)) {
				continue;
			}
			// If attendance exists but doesn't have a timeIn yet (was created as "absent"),
			// update it to "present" with timeIn
			if (!existingAttendance.timeIn && !existingAttendance.timeOut) {
				const timeIn = tapInTime > scheduledStart ? tapInTime : scheduledStart;
				const didArriveLate = isArrivalLate(scheduledStart, timeIn);

				await tx.shiftAttendance.update({
					where: { id: existingAttendance.id },
					data: {
						status: "present",
						timeIn,
						didArriveLate,
					},
				});
			}
			// If timeIn or timeOut already exists, skip (preserve first tap-in)
			continue;
		}

		// Create new attendance record if none exists
		const timeIn = tapInTime > scheduledStart ? tapInTime : scheduledStart;
		const didArriveLate = isArrivalLate(scheduledStart, timeIn);

		await tx.shiftAttendance.create({
			data: {
				shiftOccurrenceId: occurrence.id,
				userId,
				status: "present",
				timeIn,
				didArriveLate,
				didLeaveEarly: false,
			},
		});
	}
}

/**
 * Update attendance records when user taps out.
 * Only updates attendances that have a timeIn but no timeOut (first tap-out only).
 * Records without a timeIn are skipped since the user never actually tapped in.
 */
export async function handleTapOutAttendance(
	tx: Prisma.TransactionClient,
	userId: number,
	tapOutTime: Date,
): Promise<void> {
	const lookbackMs = 24 * 60 * 60 * 1000;
	const lookbackTime = new Date(tapOutTime.getTime() - lookbackMs);

	// Find all attendances with a timeIn but no timeOut for this user
	// This ensures we only record the first tap-out, and only for records
	// where the user actually tapped in
	const openAttendances = await tx.shiftAttendance.findMany({
		where: {
			userId,
			timeIn: { not: null },
			timeOut: null,
			status: { notIn: PROTECTED_ATTENDANCE_STATUSES },
			shiftOccurrence: {
				timestamp: { gte: lookbackTime, lte: tapOutTime },
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

	for (const attendance of openAttendances) {
		if (isProtectedAttendanceStatus(attendance.status)) continue;
		const scheduledStart = computeOccurrenceStart(
			new Date(attendance.shiftOccurrence.timestamp),
			attendance.shiftOccurrence.shiftSchedule.startTime,
		);

		// Skip occurrences that haven't started yet
		if (scheduledStart > tapOutTime) continue;
		const occEnd = computeOccurrenceEnd(
			scheduledStart,
			attendance.shiftOccurrence.shiftSchedule.startTime,
			attendance.shiftOccurrence.shiftSchedule.endTime,
		);

		// Only close attendance if the shift is still active or just ended
		// Use the earlier of tapOutTime or occEnd
		const timeOut = tapOutTime < occEnd ? tapOutTime : occEnd;
		const didLeaveEarly = isDepartureEarly(occEnd, timeOut);

		// Record the first tap-out time only
		await tx.shiftAttendance.update({
			where: { id: attendance.id },
			data: { timeOut, didLeaveEarly },
		});
	}
}

/**
 * Check if a user has an active attendance record (currently on a shift).
 * An active attendance is one that has a timeIn but no timeOut,
 * and the shift is still in progress.
 */
export async function hasActiveAttendance(
	tx: Prisma.TransactionClient,
	userId: number,
	now: Date = new Date(),
): Promise<boolean> {
	const lookbackMs = 24 * 60 * 60 * 1000;
	const lookbackTime = new Date(now.getTime() - lookbackMs);

	const activeAttendance = await tx.shiftAttendance.findFirst({
		where: {
			userId,
			timeIn: { not: null },
			timeOut: null,
			status: { notIn: PROTECTED_ATTENDANCE_STATUSES },
			shiftOccurrence: {
				timestamp: { gte: lookbackTime, lte: now },
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

	if (!activeAttendance) {
		return false;
	}

	// Check if the shift is still in progress
	const scheduledStart = computeOccurrenceStart(
		new Date(activeAttendance.shiftOccurrence.timestamp),
		activeAttendance.shiftOccurrence.shiftSchedule.startTime,
	);
	const occEnd = computeOccurrenceEnd(
		scheduledStart,
		activeAttendance.shiftOccurrence.shiftSchedule.startTime,
		activeAttendance.shiftOccurrence.shiftSchedule.endTime,
	);

	// Return true only if the shift hasn't ended yet
	return now < occEnd;
}
