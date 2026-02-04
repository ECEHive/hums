/**
 * Control Kiosk Routes - Tap In/Out
 *
 * This route handles session tap in/out from the control kiosk.
 * Reuses the core session logic from the regular kiosk.
 */

import {
	ConfigService,
	checkMissingAgreements,
	checkStaffingPermission,
	endSession,
	findUserByCard,
	getActiveSuspension,
	getCurrentSession,
	startSession,
	switchSessionType,
} from "@ecehive/features";
import { prisma } from "@ecehive/prisma";
import z from "zod";
import type { TControlProtectedProcedureContext } from "../../trpc";

export const ZControlTapInOutSchema = z.object({
	cardNumber: z.string().regex(/^\d+$/),
	sessionType: z.enum(["regular", "staffing"]).optional(),
	tapAction: z
		.enum(["end_session", "switch_to_staffing", "switch_to_regular"])
		.optional(),
});

export type TControlTapInOutSchema = z.infer<typeof ZControlTapInOutSchema>;

export type TControlTapInOutOptions = {
	ctx: TControlProtectedProcedureContext;
	input: TControlTapInOutSchema;
};

export async function controlTapInOutHandler(options: TControlTapInOutOptions) {
	const { cardNumber, sessionType, tapAction } = options.input;

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

		// If there is no session, create a new session (tap in)
		if (!mostRecentSession) {
			// Check if any session type is allowed
			if (!regularSessionsEnabled && !staffingSessionsEnabled) {
				throw new Error("Sessions cannot be started from this kiosk");
			}

			// Check if user is suspended
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
				// Only staffing sessions allowed
				typeToCreate = "staffing";
			}

			const session = await startSession(tx, user.id, typeToCreate, now);

			return {
				status: "tapped_in" as const,
				user,
				session,
			};
		}

		// Handle switch to staffing session
		if (tapAction === "switch_to_staffing") {
			if (!staffingSessionsEnabled) {
				throw new Error("Staffing sessions are not allowed on this kiosk");
			}

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
				status: "switched_to_staffing" as const,
				user,
				endedSession,
				newSession,
			};
		}

		// Handle switch to regular session
		if (tapAction === "switch_to_regular") {
			if (!regularSessionsEnabled) {
				throw new Error("Regular sessions are not allowed on this kiosk");
			}

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
				"regular",
				now,
			);

			return {
				status: "switched_to_regular" as const,
				user,
				endedSession,
				newSession,
			};
		}

		// End session (tap out)
		const endedSession = await endSession(tx, mostRecentSession.id, now);

		return {
			status: "tapped_out" as const,
			user,
			session: endedSession,
		};
	});
}
