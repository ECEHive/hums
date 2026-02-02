import { prisma } from "@ecehive/prisma";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZGetTimelineSnapshotsSchema = z.object({
	deviceIds: z.array(z.number()).min(1),
	startDate: z.date(),
	endDate: z.date(),
});

export type TGetTimelineSnapshotsOptions = {
	ctx: TPermissionProtectedProcedureContext;
	input: z.infer<typeof ZGetTimelineSnapshotsSchema>;
};

/**
 * Get snapshots for the timeline view.
 * Returns snapshots for selected devices within a date range.
 */
export async function getTimelineSnapshotsHandler(
	options: TGetTimelineSnapshotsOptions,
) {
	const { input } = options;
	const { deviceIds, startDate, endDate } = input;

	// Get all snapshots for the selected devices in the date range
	const snapshots = await prisma.securitySnapshot.findMany({
		where: {
			deviceId: { in: deviceIds },
			capturedAt: {
				gte: startDate,
				lte: endDate,
			},
		},
		orderBy: { capturedAt: "desc" },
		select: {
			id: true,
			eventType: true,
			capturedAt: true,
			faceDetected: true,
			faceConfidence: true,
			deviceId: true,
			device: {
				select: {
					id: true,
					name: true,
				},
			},
			user: {
				select: {
					id: true,
					name: true,
					username: true,
				},
			},
		},
		// Limit to reasonable number for timeline
		take: 500,
	});

	return { snapshots };
}
