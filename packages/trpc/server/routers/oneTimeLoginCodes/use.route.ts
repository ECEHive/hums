import { prisma } from "@ecehive/prisma";
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

	return await prisma.$transaction(async (tx) => {
		const now = new Date();

		// Find and validate the code
		const otaCode = await tx.oneTimeAccessCode.findUnique({
			where: { code },
		});

		if (!otaCode) {
			throw new Error("Invalid code");
		}

		if (otaCode.usedAt) {
			throw new Error("Code has already been used");
		}

		if (otaCode.expiresAt < now) {
			throw new Error("Code has expired");
		}

		// Mark the code as used
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
				throw new Error("You are already in a session");
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
			throw new Error("You are not in a session");
		}

		// Cannot end staffing sessions via OTA codes
		if (currentSession.sessionType === "staffing") {
			throw new Error(
				"Staffing sessions cannot be ended using this method. Please use the kiosk or contact Staff.",
			);
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
	});
}
