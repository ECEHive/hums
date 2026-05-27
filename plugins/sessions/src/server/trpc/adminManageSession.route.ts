import type { EventBus, HumsEventMap } from "@ecehive/core";
import {
	checkStaffingPermission,
	endSession,
	getCurrentSession,
	startSession,
	switchSessionType,
	validateCanEndSession,
} from "@ecehive/features";
import { prisma } from "@ecehive/prisma";
import type { TPermissionProtectedProcedureContext } from "@ecehive/trpc/server";
import { TRPCError } from "@trpc/server";
import z from "zod";

export const ZAdminManageSessionSchema = z.object({
	userId: z.number().min(1),
	action: z.enum([
		"start_general",
		"start_staffing",
		"end_current",
		"switch_to_general",
		"switch_to_staffing",
	]),
});

export type TAdminManageSessionSchema = z.infer<
	typeof ZAdminManageSessionSchema
>;

export type TAdminManageSessionOptions = {
	ctx: TPermissionProtectedProcedureContext;
	input: TAdminManageSessionSchema;
	events?: EventBus<HumsEventMap>;
};

/**
 * Admin route to manage another user's session.
 * Requires sessions.manage permission.
 */
export async function adminManageSessionHandler(
	options: TAdminManageSessionOptions,
) {
	const { userId, action } = options.input;

	const result = await prisma.$transaction(
		async (tx) => {
			const now = new Date();

			// Get target user
			const user = await tx.user.findUnique({
				where: { id: userId },
				select: {
					id: true,
					name: true,
					username: true,
					email: true,
					isSystemUser: true,
				},
			});

			if (!user) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "User not found",
				});
			}

			// Check if target user has staffing permission
			const hasStaffingPermission = await checkStaffingPermission(
				tx,
				userId,
				user.isSystemUser,
			);

			// Get user's current session
			const currentSession = await getCurrentSession(tx, userId);

			// Handle different actions
			switch (action) {
				case "start_general": {
					if (currentSession) {
						throw new TRPCError({
							code: "CONFLICT",
							message: "User is already in a session",
						});
					}

					const session = await startSession(tx, userId, "regular", now);

					return {
						action: "started_general" as const,
						session,
						user,
						now,
					};
				}

				case "start_staffing": {
					if (currentSession) {
						throw new TRPCError({
							code: "CONFLICT",
							message: "User is already in a session",
						});
					}

					if (!hasStaffingPermission) {
						throw new TRPCError({
							code: "FORBIDDEN",
							message:
								"User does not have permission to start staffing sessions",
						});
					}

					const session = await startSession(tx, userId, "staffing", now);

					return {
						action: "started_staffing" as const,
						session,
						user,
						now,
					};
				}

				case "end_current": {
					if (!currentSession) {
						throw new TRPCError({
							code: "CONFLICT",
							message: "User is not currently in a session",
						});
					}

					// Check if user has any active control points that need to be turned off first
					await validateCanEndSession(tx, userId);

					const session = await endSession(tx, currentSession.id, now);

					return {
						action: "ended_session" as const,
						session,
						user,
						now,
					};
				}

				case "switch_to_general": {
					if (!currentSession) {
						throw new TRPCError({
							code: "CONFLICT",
							message: "User is not currently in a session",
						});
					}

					const { endedSession, newSession } = await switchSessionType(
						tx,
						currentSession.id,
						"regular",
						now,
					);

					return {
						action: "switched_to_general" as const,
						endedSession,
						newSession,
						user,
						now,
						previousType: currentSession.sessionType as "regular" | "staffing",
					};
				}

				case "switch_to_staffing": {
					if (!currentSession) {
						throw new TRPCError({
							code: "CONFLICT",
							message: "User is not currently in a session",
						});
					}

					if (!hasStaffingPermission) {
						throw new TRPCError({
							code: "FORBIDDEN",
							message:
								"User does not have permission to start staffing sessions",
						});
					}

					const { endedSession, newSession } = await switchSessionType(
						tx,
						currentSession.id,
						"staffing",
						now,
					);

					return {
						action: "switched_to_staffing" as const,
						endedSession,
						newSession,
						user,
						now,
						previousType: currentSession.sessionType as "regular" | "staffing",
					};
				}

				default:
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "Invalid action",
					});
			}
		},
		{ maxWait: 5000, timeout: 10000 },
	);

	// Emit events after the transaction commits
	if (
		result.action === "started_general" ||
		result.action === "started_staffing"
	) {
		options.events?.emit("session:started", {
			sessionId: result.session.id,
			userId,
			sessionType: result.session.sessionType,
			startedAt: result.session.startedAt,
		});
	} else if (result.action === "ended_session") {
		options.events?.emit("session:ended", {
			sessionId: result.session.id,
			userId,
			sessionType: result.session.sessionType,
			startedAt: result.session.startedAt,
			endedAt: result.now,
		});
	} else if (
		result.action === "switched_to_general" ||
		result.action === "switched_to_staffing"
	) {
		const newType =
			result.action === "switched_to_general" ? "regular" : "staffing";
		options.events?.emit("session:ended", {
			sessionId: result.endedSession.id,
			userId,
			sessionType: result.endedSession.sessionType,
			startedAt: result.endedSession.startedAt,
			endedAt: result.now,
		});
		options.events?.emit("session:started", {
			sessionId: result.newSession.id,
			userId,
			sessionType: newType,
			startedAt: result.newSession.startedAt,
		});
		options.events?.emit("session:type-switched", {
			previousSessionId: result.endedSession.id,
			newSessionId: result.newSession.id,
			userId,
			previousType: result.previousType,
			newType,
		});
	}

	// Strip internal fields before returning
	if (
		result.action === "switched_to_general" ||
		result.action === "switched_to_staffing"
	) {
		const { previousType: _previousType, now: _now, ...rest } = result;
		return rest;
	}

	const { now: _now, ...rest } = result;
	return rest;
}
