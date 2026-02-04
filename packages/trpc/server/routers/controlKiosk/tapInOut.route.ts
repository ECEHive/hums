/**
 * Control Kiosk Routes - Tap In/Out
 *
 * This route handles session tap in/out from the control kiosk.
 * The control kiosk only supports staffing-related session actions:
 * - Start staffing session (when no active session)
 * - Switch to staffing (from regular session)
 * - Switch to regular (from staffing session)
 *
 * Regular sessions cannot be started or ended from the control kiosk.
 */

import {
	ConfigService,
	checkMissingAgreements,
	checkStaffingPermission,
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
	// Control kiosk only supports starting staffing sessions
	sessionType: z.literal("staffing").optional(),
	// Control kiosk only supports switching between staffing and regular
	tapAction: z.enum(["switch_to_staffing", "switch_to_regular"]).optional(),
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

		// If there is no session and requesting to start a staffing session
		if (!mostRecentSession) {
			// Control kiosk only allows starting staffing sessions
			if (!sessionType || sessionType !== "staffing") {
				throw new Error("Control kiosk can only start staffing sessions");
			}

			if (!staffingSessionsEnabled) {
				throw new Error("Staffing sessions are not enabled on this kiosk");
			}

			// Verify user has staffing permission
			if (!hasStaffingPermission) {
				throw new Error(
					"You do not have permission to start staffing sessions",
				);
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

			const session = await startSession(tx, user.id, "staffing", now);

			return {
				status: "tapped_in" as const,
				user,
				session,
			};
		}

		// User has an active session - handle switch actions only
		// Control kiosk does not allow ending sessions directly

		// Handle switch to staffing session
		if (tapAction === "switch_to_staffing") {
			if (!staffingSessionsEnabled) {
				throw new Error("Staffing sessions are not enabled on this kiosk");
			}

			// Verify user has staffing permission
			if (!hasStaffingPermission) {
				throw new Error(
					"You do not have permission to start staffing sessions",
				);
			}

			// Check if already in a staffing session
			if (mostRecentSession.sessionType === "staffing") {
				throw new Error("You are already in a staffing session");
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
				throw new Error("Regular sessions are not enabled on this kiosk");
			}

			// Check if already in a regular session
			if (mostRecentSession.sessionType === "regular") {
				throw new Error("You are already in a regular session");
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

		// No valid action specified for a user with an active session
		// Control kiosk cannot end sessions directly
		throw new Error(
			"Control kiosk does not support ending sessions. Use switch actions or end your session at the main kiosk.",
		);
	});
}
