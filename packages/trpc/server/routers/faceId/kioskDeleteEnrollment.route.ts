/**
 * Delete Face ID enrollment from kiosk
 * Used during re-enrollment flow when user taps card at kiosk
 */

import { getLogger } from "@ecehive/logger";
import { prisma } from "@ecehive/prisma";
import z from "zod";
import type { TKioskProtectedProcedureContext } from "../../trpc";

const logger = getLogger("faceId:kioskDelete");

export const ZKioskDeleteEnrollmentSchema = z.object({
	userId: z.number(),
});

export type TKioskDeleteEnrollmentOptions = {
	ctx: TKioskProtectedProcedureContext;
	input: z.infer<typeof ZKioskDeleteEnrollmentSchema>;
};

export async function kioskDeleteEnrollmentHandler(
	options: TKioskDeleteEnrollmentOptions,
) {
	const { ctx, input } = options;
	const { userId } = input;

	// Find and delete enrollment
	const enrollment = await prisma.faceEnrollment.findUnique({
		where: { userId },
	});

	if (!enrollment) {
		// Not found is OK - user might not have enrollment
		logger.info("No Face ID enrollment found for deletion", {
			userId,
			deviceId: ctx.device.id,
		});
		return { success: true, deleted: false };
	}

	// Delete the enrollment
	await prisma.faceEnrollment.delete({
		where: { userId },
	});

	// Disable Face ID for the user
	await prisma.user.update({
		where: { id: userId },
		data: { faceIdEnabled: false },
	});

	logger.info("Face ID enrollment deleted from kiosk", {
		userId,
		deviceId: ctx.device.id,
	});

	return { success: true, deleted: true };
}
