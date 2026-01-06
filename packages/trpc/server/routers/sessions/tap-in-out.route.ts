import {
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

export async function tapInOutHandler(options: TTapInOutOptions) {
	const { cardNumber, sessionType, tapAction } = options.input;

	const user = await findUserByCard(cardNumber);

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

			const session = await startSession(tx, user.id, typeToCreate, now);

			return {
				status: "tapped_in",
				user,
				session,
			};
		}

		// Otherwise, handle tap-out or switch
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
		const session = await endSession(tx, mostRecentSession.id, now);

		return {
			status: "tapped_out",
			user,
			session,
		};
	});
}
