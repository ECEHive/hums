import {
	checkStaffingPermission,
	endSession,
	getCurrentSession,
	startSession,
	switchSessionType,
	validateCanEndSession,
} from "@ecehive/features";
import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

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
};

/**
 * Admin route to manage another user's session
 * Requires sessions.manage permission
 */
export async function adminManageSessionHandler(
	options: TAdminManageSessionOptions,
) {
	const { userId, action } = options.input;

	return await prisma.$transaction(
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
					};
				}

				default:
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "Invalid action",
					});
			}
		},
		{
			maxWait: 5000,
			timeout: 10000,
		},
	);
}
