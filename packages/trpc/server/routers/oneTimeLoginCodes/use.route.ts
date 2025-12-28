import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import z from "zod";
import type { TProtectedProcedureContext } from "../../trpc";

export const ZUseSchema = z.object({
	code: z.string().length(16), // 8 bytes in hex = 16 characters
	action: z.enum(["login", "logout"]),
});

export type TUseSchema = z.infer<typeof ZUseSchema>;

export type TUseOptions = {
	ctx: TProtectedProcedureContext;
	input: TUseSchema;
};

/**
 * Use a one-time login code to start or end a session
 * Code can only be used once and must not be expired
 */
export async function useHandler(options: TUseOptions) {
	const { code, action } = options.input;
	const userId = options.ctx.user.id;

	return await prisma.$transaction(
		async (tx) => {
			const now = new Date();

			// Find and validate the code with FOR UPDATE to prevent race conditions
			const otaCode = await tx.oneTimeAccessCode.findUnique({
				where: { code },
			});

			if (!otaCode) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Invalid code",
				});
			}

			if (otaCode.usedAt) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Code has already been used",
				});
			}

			if (otaCode.expiresAt < now) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Code has expired",
				});
			}

			// Mark the code as used immediately to prevent race conditions
			await tx.oneTimeAccessCode.update({
				where: { code },
				data: { usedAt: now },
			});

			// Get user's current session status
			const currentSession = await tx.session.findFirst({
				where: {
					userId,
					endedAt: null,
				},
				orderBy: { startedAt: "desc" },
			});

			// Check if user has staffing permission
			const hasStaffingPermission =
				options.ctx.user.isSystemUser ||
				(await tx.permission.findFirst({
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
				})) !== null;

			if (action === "login") {
				// Cannot login if already in a session
				if (currentSession) {
					throw new TRPCError({
						code: "CONFLICT",
						message: "You are already in a session",
					});
				}

				// Create a new regular session (not staffing)
				const session = await tx.session.create({
					data: {
						userId,
						sessionType: "regular",
						startedAt: now,
					},
				});

				return {
					action: "login" as const,
					session,
					hasStaffingPermission,
				};
			}
			// action === "logout"
			// Cannot logout if not in a session
			if (!currentSession) {
				throw new TRPCError({
					code: "CONFLICT",
					message: "You are not in a session",
				});
			}

			// Cannot end staffing sessions via OTA codes
			if (currentSession.sessionType === "staffing") {
				throw new TRPCError({
					code: "FORBIDDEN",
					message:
						"Staffing sessions cannot be ended using this method. Please use the kiosk or contact Staff.",
				});
			}

			// End the current session
			const session = await tx.session.update({
				where: { id: currentSession.id },
				data: { endedAt: now },
			});

			return {
				action: "logout" as const,
				session,
				hasStaffingPermission,
			};
		},
		{
			maxWait: 5000, // Maximum time to wait for a transaction slot
			timeout: 10000, // Maximum time for the transaction to complete
		},
	);
}
