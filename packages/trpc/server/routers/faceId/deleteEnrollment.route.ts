import { getLogger } from "@ecehive/logger";
import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import z from "zod";
import type { TProtectedProcedureContext } from "../../trpc";

const logger = getLogger("faceId:delete");

export const ZDeleteEnrollmentSchema = z.object({
	// Optional: Admin can delete any user's enrollment by specifying userId
	userId: z.number().optional(),
});

export type TDeleteEnrollmentOptions = {
	ctx: TProtectedProcedureContext;
	input: z.infer<typeof ZDeleteEnrollmentSchema>;
};

export async function deleteEnrollmentHandler(
	options: TDeleteEnrollmentOptions,
) {
	const { ctx, input } = options;

	// Use provided userId or default to current user
	const targetUserId = input.userId ?? ctx.user.id;

	// If trying to delete another user's enrollment, check for admin permission
	if (targetUserId !== ctx.user.id && !ctx.user.isSystemUser) {
		// Check for security.manage permission
		const hasPermission = await prisma.permission.findFirst({
			where: {
				name: "security.manage",
				roles: {
					some: {
						users: {
							some: {
								id: ctx.user.id,
							},
						},
					},
				},
			},
		});

		if (!hasPermission) {
			throw new TRPCError({
				code: "FORBIDDEN",
				message:
					"You do not have permission to delete other users' Face ID enrollment",
			});
		}
	}

	// Find and delete enrollment
	const enrollment = await prisma.faceEnrollment.findUnique({
		where: { userId: targetUserId },
	});

	if (!enrollment) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "No Face ID enrollment found",
		});
	}

	await prisma.faceEnrollment.delete({
		where: { userId: targetUserId },
	});

	// Disable Face ID for the user
	await prisma.user.update({
		where: { id: targetUserId },
		data: { faceIdEnabled: false },
	});

	logger.info("Face ID enrollment deleted", {
		targetUserId,
		deletedBy: ctx.user.id,
	});

	return { success: true };
}
