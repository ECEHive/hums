import { prisma } from "@ecehive/prisma";
import type { TProtectedProcedureContext } from "../../trpc";

export type TGetMyEnrollmentOptions = {
	ctx: TProtectedProcedureContext;
};

export async function getMyEnrollmentHandler(options: TGetMyEnrollmentOptions) {
	const { ctx } = options;

	const enrollment = await prisma.faceEnrollment.findUnique({
		where: { userId: ctx.user.id },
		select: {
			id: true,
			enrolledAt: true,
			lastUsedAt: true,
			successfulMatches: true,
		},
	});

	return {
		enrolled: !!enrollment,
		enrollment: enrollment
			? {
					id: enrollment.id,
					enrolledAt: enrollment.enrolledAt,
					lastUsedAt: enrollment.lastUsedAt,
					successfulMatches: enrollment.successfulMatches,
				}
			: null,
		faceIdEnabled: ctx.user.faceIdEnabled,
	};
}
