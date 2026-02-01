import { prisma } from "@ecehive/prisma";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZGetLatestByDeviceSchema = z.object({});

export type TGetLatestByDeviceOptions = {
	ctx: TPermissionProtectedProcedureContext;
	input: z.infer<typeof ZGetLatestByDeviceSchema>;
};

/**
 * Get the most recent snapshot from each device.
 * Used for the live view to show current state of all kiosks.
 */
export async function getLatestByDeviceHandler(
	_options: TGetLatestByDeviceOptions,
) {
	// First get all active devices
	const devices = await prisma.device.findMany({
		where: { isActive: true },
		select: {
			id: true,
			name: true,
		},
	});

	// For each device, get the most recent snapshot
	const deviceSnapshots = await Promise.all(
		devices.map(async (device) => {
			const snapshot = await prisma.securitySnapshot.findFirst({
				where: { deviceId: device.id },
				orderBy: { capturedAt: "desc" },
				select: {
					id: true,
					eventType: true,
					capturedAt: true,
					faceDetected: true,
					faceConfidence: true,
					user: {
						select: {
							id: true,
							name: true,
							username: true,
						},
					},
				},
			});

			return {
				device,
				snapshot,
			};
		}),
	);

	return { deviceSnapshots };
}
