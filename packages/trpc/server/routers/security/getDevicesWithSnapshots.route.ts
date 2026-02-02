import { prisma } from "@ecehive/prisma";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZGetDevicesWithSnapshotsSchema = z.object({});

export type TGetDevicesWithSnapshotsOptions = {
	ctx: TPermissionProtectedProcedureContext;
	input: z.infer<typeof ZGetDevicesWithSnapshotsSchema>;
};

/**
 * Get all active devices that have at least one snapshot.
 * Used for the timeline view device selection.
 */
export async function getDevicesWithSnapshotsHandler(
	_options: TGetDevicesWithSnapshotsOptions,
) {
	// Get all active devices that have at least one snapshot
	const devices = await prisma.device.findMany({
		where: {
			isActive: true,
			securitySnapshots: {
				some: {},
			},
		},
		select: {
			id: true,
			name: true,
			_count: {
				select: {
					securitySnapshots: true,
				},
			},
		},
		orderBy: { name: "asc" },
	});

	return {
		devices: devices.map((d) => ({
			id: d.id,
			name: d.name,
			snapshotCount: d._count.securitySnapshots,
		})),
	};
}
