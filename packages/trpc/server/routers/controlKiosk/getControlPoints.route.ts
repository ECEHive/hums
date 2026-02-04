/**
 * Control Kiosk Routes - Get Control Points
 *
 * This route returns the control points available on the current device
 * along with their current state.
 */

import { prisma } from "@ecehive/prisma";
import { z } from "zod";
import type { TControlProtectedProcedureContext } from "../../trpc";

export const ZGetControlPointsSchema = z.object({});

type GetControlPointsOptions = {
	ctx: TControlProtectedProcedureContext;
	input: z.infer<typeof ZGetControlPointsSchema>;
};

export async function getControlPointsHandler({
	ctx,
}: GetControlPointsOptions) {
	// Get the latest state of all control points assigned to this device
	const controlPointIds = ctx.device.controlPoints.map((cp) => cp.id);

	const controlPoints = await prisma.controlPoint.findMany({
		where: {
			id: { in: controlPointIds },
			isActive: true,
		},
		select: {
			id: true,
			name: true,
			description: true,
			location: true,
			controlClass: true,
			currentState: true,
			isActive: true,
			canControlOnline: true,
			authorizedRoles: { select: { id: true, name: true } },
			authorizedUsers: { select: { id: true, name: true } },
		},
		orderBy: { name: "asc" },
	});

	return {
		controlPoints,
		deviceName: ctx.device.name,
	};
}
