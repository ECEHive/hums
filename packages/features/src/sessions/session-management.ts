import {
	computeOccurrenceEnd,
	computeOccurrenceStart,
	isArrivalLate,
	isDepartureEarly,
} from "@ecehive/features";
import type { Prisma, ShiftAttendanceStatus } from "@ecehive/prisma";

const PROTECTED_ATTENDANCE_STATUSES: ShiftAttendanceStatus[] = [
	"dropped",
	"dropped_makeup",
];

function isProtectedAttendanceStatus(
	status?: ShiftAttendanceStatus | null,
): boolean {
	return status ? PROTECTED_ATTENDANCE_STATUSES.includes(status) : false;
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
 * Create or update attendance records when user taps in
 * Updates existing "absent" records (with no timeIn) to "present"
 */
export async function handleTapInAttendance(
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
 * Update attendance records when user taps out
 * Only updates attendances that don't already have a timeOut (first tap-out only)
 */
export async function handleTapOutAttendance(
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
			status: { notIn: PROTECTED_ATTENDANCE_STATUSES },
			shiftOccurrence: {
				timestamp: { lte: tapOutTime },
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
 * Check if a user has the sessions.staffing permission
 */
export async function checkStaffingPermission(
	tx: Prisma.TransactionClient,
	userId: number,
	isSystemUser: boolean,
): Promise<boolean> {
	if (isSystemUser) return true;

	const permission = await tx.permission.findFirst({
		where: {
			name: "sessions.staffing",
			roles: {
				some: {
					users: {
						some: {
							id: userId,
						},
					},
				},
			},
		},
	});

	return permission !== null;
}

/**
 * Check for missing agreements that a user needs to accept
 */
export async function checkMissingAgreements(
	tx: Prisma.TransactionClient,
	userId: number,
): Promise<
	Array<{
		id: number;
		title: string;
		content: string;
		confirmationText: string;
	}>
> {
	const enabledAgreements = await tx.agreement.findMany({
		where: { isEnabled: true },
		select: {
			id: true,
			title: true,
			content: true,
			confirmationText: true,
		},
	});

	if (enabledAgreements.length === 0) {
		return [];
	}

	const userAgreements = await tx.userAgreement.findMany({
		where: {
			userId,
			agreementId: { in: enabledAgreements.map((a) => a.id) },
		},
		select: { agreementId: true },
	});

	const agreedIds = new Set(userAgreements.map((ua) => ua.agreementId));
	return enabledAgreements.filter((a) => !agreedIds.has(a.id));
}

/**
 * Start a new session for a user
 */
export async function startSession(
	tx: Prisma.TransactionClient,
	userId: number,
	sessionType: "regular" | "staffing",
	startTime: Date = new Date(),
) {
	const session = await tx.session.create({
		data: {
			userId,
			sessionType,
			startedAt: startTime,
		},
	});

	// Handle attendance for staffing sessions
	if (sessionType === "staffing") {
		await handleTapInAttendance(tx, userId, startTime);
	}

	return session;
}

/**
 * End an existing session
 */
export async function endSession(
	tx: Prisma.TransactionClient,
	sessionId: number,
	endTime: Date = new Date(),
) {
	const session = await tx.session.update({
		where: { id: sessionId },
		data: { endedAt: endTime },
	});

	// Handle attendance for staffing sessions
	if (session.sessionType === "staffing") {
		await handleTapOutAttendance(tx, session.userId, endTime);
	}

	return session;
}

/**
 * Switch a user's session type (end current, start new)
 */
export async function switchSessionType(
	tx: Prisma.TransactionClient,
	currentSessionId: number,
	newSessionType: "regular" | "staffing",
	switchTime: Date = new Date(),
) {
	// Get current session to access userId and type
	const currentSession = await tx.session.findUnique({
		where: { id: currentSessionId },
		select: { userId: true, sessionType: true },
	});

	if (!currentSession) {
		throw new Error("Session not found");
	}

	// End current session
	const endedSession = await endSession(tx, currentSessionId, switchTime);

	// Start new session
	const newSession = await startSession(
		tx,
		currentSession.userId,
		newSessionType,
		switchTime,
	);

	return { endedSession, newSession };
}

/**
 * Get the current active session for a user
 */
export async function getCurrentSession(
	tx: Prisma.TransactionClient,
	userId: number,
) {
	return await tx.session.findFirst({
		where: {
			userId,
			endedAt: null,
		},
		orderBy: { startedAt: "desc" },
	});
}
