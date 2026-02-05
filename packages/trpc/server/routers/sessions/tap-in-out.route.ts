import {
	ConfigService,
	checkMissingAgreements,
	checkStaffingPermission,
	endSession,
	findUserByCard,
	getActiveSuspension,
	getCurrentSession,
	hasActiveAttendance,
	startSession,
	switchSessionType,
	validateCanEndSession,
} from "@ecehive/features";
import { prisma } from "@ecehive/prisma";
import z from "zod";
import type { TKioskProtectedProcedureContext } from "../../trpc";

const EARLY_LEAVE_THRESHOLD_MS = 60000; // 1 minute

export const ZTapInOutSchema = z.object({
	cardNumber: z.string().regex(/^\d+$/),
	sessionType: z.enum(["regular", "staffing"]).optional(),
	tapAction: z
		.enum(["end_session", "switch_to_staffing", "switch_to_regular"])
		.optional(),
	forceEarlyLeave: z.boolean().optional(),
	forceShiftEarlyLeave: z.boolean().optional(),
});

export type TTapInOutSchema = z.infer<typeof ZTapInOutSchema>;

export type TTapInOutOptions = {
	ctx: TKioskProtectedProcedureContext;
	input: TTapInOutSchema;
};

export async function tapInOutHandler(options: TTapInOutOptions) {
	const {
		cardNumber,
		sessionType,
		tapAction,
		forceEarlyLeave,
		forceShiftEarlyLeave,
	} = options.input;

	const user = await findUserByCard(cardNumber);

	// Get kiosk session type configuration
	const [regularSessionsEnabled, staffingSessionsEnabled] = await Promise.all([
		ConfigService.get("kiosk.sessions.regular.enabled"),
		ConfigService.get("kiosk.sessions.staffing.enabled"),
	]);

	return await prisma.$transaction(async (tx) => {
		const now = new Date();

		// Check if user has sessions.staffing permission
		const hasStaffingPermission = await checkStaffingPermission(
			tx,
			user.id,
			user.isSystemUser,
		);

		// Get the most recent session for the user
		const mostRecentSession = await getCurrentSession(tx, user.id);

		// If there is no session, or the most recent session has an endedAt, create a new session (tap in)
		if (!mostRecentSession) {
			// Check if any session type is allowed on kiosks
			if (!regularSessionsEnabled && !staffingSessionsEnabled) {
				throw new Error("Sessions cannot be started from this kiosk");
			}

			// Check if user is suspended FIRST - they cannot start a new session
			const activeSuspension = await getActiveSuspension(tx, user.id, now);
			if (activeSuspension) {
				return {
					status: "suspended" as const,
					user,
					suspension: {
						endDate: activeSuspension.endDate,
						externalNotes: activeSuspension.externalNotes,
					},
				};
			}

			// Check if user has agreed to all enabled agreements
			const missingAgreements = await checkMissingAgreements(tx, user.id);

			if (missingAgreements.length > 0) {
				return {
					status: "agreements_required" as const,
					user,
					missingAgreements,
				};
			}

			// User with staffing permission must specify session type (if both types are enabled)
			// This happens AFTER agreement check
			if (
				hasStaffingPermission &&
				!sessionType &&
				regularSessionsEnabled &&
				staffingSessionsEnabled
			) {
				return {
					status: "choose_session_type" as const,
					user,
				};
			}

			// Determine the session type to create
			let typeToCreate: "regular" | "staffing";

			if (sessionType) {
				// Validate that the requested session type is allowed
				if (sessionType === "regular" && !regularSessionsEnabled) {
					throw new Error("Regular sessions are not allowed on this kiosk");
				}
				if (sessionType === "staffing" && !staffingSessionsEnabled) {
					throw new Error("Staffing sessions are not allowed on this kiosk");
				}
				// Verify user has staffing permission when requesting staffing session
				if (sessionType === "staffing" && !hasStaffingPermission) {
					throw new Error(
						"You do not have permission to start staffing sessions",
					);
				}
				typeToCreate = sessionType;
			} else if (
				hasStaffingPermission &&
				staffingSessionsEnabled &&
				!regularSessionsEnabled
			) {
				// Staff user but only staffing sessions allowed
				typeToCreate = "staffing";
			} else if (regularSessionsEnabled) {
				// Default to regular if allowed
				typeToCreate = "regular";
			} else {
				// Only staffing sessions allowed - verify user has permission
				if (!hasStaffingPermission) {
					throw new Error(
						"You do not have permission to start staffing sessions",
					);
				}
				typeToCreate = "staffing";
			}

			const session = await startSession(tx, user.id, typeToCreate, now);

			return {
				status: "tapped_in",
				user,
				session,
			};
		}

		// Otherwise, handle tap-out or switch
		// User with staffing permission must specify action (if both session types are enabled)
		if (
			hasStaffingPermission &&
			!tapAction &&
			regularSessionsEnabled &&
			staffingSessionsEnabled
		) {
			return {
				status: "choose_tap_out_action" as const,
				user,
				currentSession: mostRecentSession,
			};
		}

		// Handle switch to staffing session
		if (tapAction === "switch_to_staffing") {
			// Check if staffing sessions are allowed on this kiosk
			if (!staffingSessionsEnabled) {
				throw new Error("Staffing sessions are not allowed on this kiosk");
			}

			// Check suspension for switches too - they involve starting a new session
			const activeSuspension = await getActiveSuspension(tx, user.id, now);
			if (activeSuspension) {
				return {
					status: "suspended" as const,
					user,
					suspension: {
						endDate: activeSuspension.endDate,
						externalNotes: activeSuspension.externalNotes,
					},
				};
			}

			const { endedSession, newSession } = await switchSessionType(
				tx,
				mostRecentSession.id,
				"staffing",
				now,
			);

			return {
				status: "switched_to_staffing",
				user,
				endedSession,
				newSession,
			};
		}

		// Handle switch to regular session
		if (tapAction === "switch_to_regular") {
			// Check if regular sessions are allowed on this kiosk
			if (!regularSessionsEnabled) {
				throw new Error("Regular sessions are not allowed on this kiosk");
			}

			// Check suspension for switches too - they involve starting a new session
			const activeSuspension = await getActiveSuspension(tx, user.id, now);
			if (activeSuspension) {
				return {
					status: "suspended" as const,
					user,
					suspension: {
						endDate: activeSuspension.endDate,
						externalNotes: activeSuspension.externalNotes,
					},
				};
			}

			// Check if leaving staffing session early (has active attendance)
			if (
				mostRecentSession.sessionType === "staffing" &&
				!forceShiftEarlyLeave
			) {
				const hasActive = await hasActiveAttendance(tx, user.id, now);
				if (hasActive) {
					return {
						status: "confirm_shift_early_leave" as const,
						user,
						currentSession: mostRecentSession,
						action: "switch_to_regular" as const,
					};
				}
			}

			const { endedSession, newSession } = await switchSessionType(
				tx,
				mostRecentSession.id,
				"regular",
				now,
			);

			return {
				status: "switched_to_regular",
				user,
				endedSession,
				newSession,
			};
		}

		// Default: end session (tap out) - ALLOWED even if suspended
		// For non-staff users, check if this is an early leave (within 1 minute)
		if (!hasStaffingPermission && !forceEarlyLeave) {
			const sessionDuration =
				now.getTime() - mostRecentSession.startedAt.getTime();
			if (sessionDuration < EARLY_LEAVE_THRESHOLD_MS) {
				return {
					status: "confirm_early_leave" as const,
					user,
					currentSession: mostRecentSession,
				};
			}
		}

		// For staff users leaving a staffing session, check if they have active attendance
		if (mostRecentSession.sessionType === "staffing" && !forceShiftEarlyLeave) {
			const hasActive = await hasActiveAttendance(tx, user.id, now);
			if (hasActive) {
				return {
					status: "confirm_shift_early_leave" as const,
					user,
					currentSession: mostRecentSession,
					action: "end_session" as const,
				};
			}
		}

		// Check if user has any active control points that need to be turned off first
		await validateCanEndSession(tx, user.id);

		const session = await endSession(tx, mostRecentSession.id, now);

		return {
			status: "tapped_out",
			user,
			session,
		};
	});
}
