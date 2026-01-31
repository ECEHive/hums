import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZAdminCreatePastSessionSchema = z
	.object({
		userId: z.number().min(1),
		sessionType: z.enum(["regular", "staffing"]),
		startedAt: z.coerce.date(),
		endedAt: z.coerce.date(),
	})
	.refine(
		(data) => {
			const now = new Date();
			return data.startedAt < now && data.endedAt < now;
		},
		{
			message: "Both start and end dates must be in the past",
			path: ["startedAt"],
		},
	)
	.refine(
		(data) => {
			return data.startedAt < data.endedAt;
		},
		{
			message: "Start date must be before end date",
			path: ["startedAt"],
		},
	);

export type TAdminCreatePastSessionSchema = z.infer<
	typeof ZAdminCreatePastSessionSchema
>;

export type TAdminCreatePastSessionOptions = {
	ctx: TPermissionProtectedProcedureContext;
	input: TAdminCreatePastSessionSchema;
};

/**
 * Admin route to manually create a past session for a user
 * Requires sessions.manage permission
 * The session is marked as manually created
 */
export async function adminCreatePastSessionHandler(
	options: TAdminCreatePastSessionOptions,
) {
	const { userId, sessionType, startedAt, endedAt } = options.input;

	return await prisma.$transaction(
		async (tx) => {
			// Verify the user exists
			const user = await tx.user.findUnique({
				where: { id: userId },
				select: {
					id: true,
					name: true,
					username: true,
					email: true,
				},
			});

			if (!user) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "User not found",
				});
			}

			// Check for overlapping sessions
			const overlappingSessions = await tx.session.findMany({
				where: {
					userId,
					OR: [
						{
							// Session starts during our new session
							startedAt: {
								gte: startedAt,
								lt: endedAt,
							},
						},
						{
							// Session ends during our new session (for completed sessions)
							endedAt: {
								gt: startedAt,
								lte: endedAt,
							},
						},
						{
							// Session spans our entire new session
							AND: [
								{ startedAt: { lte: startedAt } },
								{
									OR: [{ endedAt: { gte: endedAt } }, { endedAt: null }],
								},
							],
						},
					],
				},
			});

			if (overlappingSessions.length > 0) {
				throw new TRPCError({
					code: "CONFLICT",
					message:
						"This session would overlap with an existing session for this user",
				});
			}

			// Create the session with the manual flag
			const session = await tx.session.create({
				data: {
					userId,
					sessionType,
					startedAt,
					endedAt,
					isManuallyCreated: true,
				},
			});

			// Calculate duration for the response
			const durationMs = endedAt.getTime() - startedAt.getTime();
			const durationMinutes = Math.round(durationMs / (1000 * 60));
			const hours = Math.floor(durationMinutes / 60);
			const minutes = durationMinutes % 60;
			const durationFormatted =
				hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

			return {
				session,
				user,
				durationMinutes,
				durationFormatted,
			};
		},
		{
			maxWait: 5000,
			timeout: 10000,
		},
	);
}
