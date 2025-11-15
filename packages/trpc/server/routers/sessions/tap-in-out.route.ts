import {
	computeOccurrenceEnd,
	computeOccurrenceStart,
	findUserByCard,
	isArrivalLate,
	isDepartureEarly,
} from "@ecehive/features";
import type { Prisma } from "@ecehive/prisma";
import { prisma } from "@ecehive/prisma";
import z from "zod";
import type { TKioskProtectedProcedureContext } from "../../trpc";

export const ZTapInOutSchema = z.object({
	cardNumber: z.string().regex(/^\d+$/),
	sessionType: z.enum(["regular", "staffing"]).optional(),
	tapAction: z
		.enum(["end_session", "switch_to_staffing", "switch_to_regular"])
		.optional(),
});

export type TTapInOutSchema = z.infer<typeof ZTapInOutSchema>;

export type TTapInOutOptions = {
	ctx: TKioskProtectedProcedureContext;
	input: TTapInOutSchema;
};

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
		const scheduledStart = computeOccurrenceStart(
			new Date(occurrence.timestamp),
			occurrence.shiftSchedule.startTime,
		);

		if (existingAttendance) {
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

export async function tapInOutHandler(options: TTapInOutOptions) {
	const { cardNumber, sessionType, tapAction } = options.input;

	const user = await findUserByCard(cardNumber);

	return await prisma.$transaction(async (tx) => {
		const now = new Date();

		// Check if user has sessions.staffing permission
		const hasStaffingPermission =
			user.isSystemUser ||
			(await tx.permission.findFirst({
				where: {
					name: "sessions.staffing",
					roles: {
						some: {
							users: {
								some: {
									id: user.id,
								},
							},
						},
					},
				},
			})) !== null;

		// Get the most recent session for the user
		const mostRecentSession = await tx.session.findFirst({
			where: { userId: user.id },
			orderBy: { startedAt: "desc" },
		});

		// If there is no session, or the most recent session has an endedAt, create a new session (tap in)
		if (!mostRecentSession || mostRecentSession.endedAt) {
			// Check if user has agreed to all enabled agreements FIRST
			const enabledAgreements = await tx.agreement.findMany({
				where: { isEnabled: true },
				select: {
					id: true,
					title: true,
					content: true,
					confirmationText: true,
				},
			});

			if (enabledAgreements.length > 0) {
				const userAgreements = await tx.userAgreement.findMany({
					where: {
						userId: user.id,
						agreementId: { in: enabledAgreements.map((a) => a.id) },
					},
					select: { agreementId: true },
				});

				const agreedIds = new Set(userAgreements.map((ua) => ua.agreementId));
				const missingAgreements = enabledAgreements.filter(
					(a) => !agreedIds.has(a.id),
				);

				if (missingAgreements.length > 0) {
					return {
						status: "agreements_required" as const,
						user,
						missingAgreements: missingAgreements.map((a) => ({
							id: a.id,
							title: a.title,
							content: a.content,
							confirmationText: a.confirmationText,
						})),
					};
				}
			}

			// User with staffing permission must specify session type
			// This happens AFTER agreement check
			if (hasStaffingPermission && !sessionType) {
				return {
					status: "choose_session_type" as const,
					user,
				};
			}

			// Determine the session type to create
			const typeToCreate = sessionType || "regular";

			const session = await tx.session.create({
				data: {
					userId: user.id,
					sessionType: typeToCreate,
					startedAt: now,
				},
			});

			// Handle attendance for active shifts (only for staffing sessions)
			if (typeToCreate === "staffing") {
				await handleTapInAttendance(tx, user.id, now);
			}
			return {
				status: "tapped_in",
				user,
				session,
			};
		} // Otherwise, handle tap-out or switch
		// User with staffing permission must specify action
		if (hasStaffingPermission && !tapAction) {
			return {
				status: "choose_tap_out_action" as const,
				user,
				currentSession: mostRecentSession,
			};
		}

		// Handle switch to staffing session
		if (tapAction === "switch_to_staffing") {
			// End current session
			const endedSession = await tx.session.update({
				where: { id: mostRecentSession.id },
				data: { endedAt: now },
			});

			// Handle attendance for tap-out (only if ending a staffing session)
			if (endedSession.sessionType === "staffing") {
				await handleTapOutAttendance(tx, user.id, now);
			}

			// Start new staffing session
			const newSession = await tx.session.create({
				data: {
					userId: user.id,
					sessionType: "staffing",
					startedAt: now,
				},
			});

			// Handle attendance for new staffing session
			await handleTapInAttendance(tx, user.id, now);

			return {
				status: "switched_to_staffing",
				user,
				endedSession,
				newSession,
			};
		}

		// Handle switch to regular session
		if (tapAction === "switch_to_regular") {
			// End current session
			const endedSession = await tx.session.update({
				where: { id: mostRecentSession.id },
				data: { endedAt: now },
			});

			// Handle attendance for tap-out (only if ending a staffing session)
			if (endedSession.sessionType === "staffing") {
				await handleTapOutAttendance(tx, user.id, now);
			}

			// Start new regular session
			const newSession = await tx.session.create({
				data: {
					userId: user.id,
					sessionType: "regular",
					startedAt: now,
				},
			});

			// Don't handle attendance for regular sessions

			return {
				status: "switched_to_regular",
				user,
				endedSession,
				newSession,
			};
		}

		// Default: end session (tap out)
		const session = await tx.session.update({
			where: { id: mostRecentSession.id },
			data: { endedAt: now },
		});

		// Handle attendance for active shifts (only for staffing sessions)
		if (session.sessionType === "staffing") {
			await handleTapOutAttendance(tx, user.id, now);
		}

		return {
			status: "tapped_out",
			user,
			session,
		};
	});
}
