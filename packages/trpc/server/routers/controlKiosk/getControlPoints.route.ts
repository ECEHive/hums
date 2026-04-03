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

	// For control points that are currently on, find who last turned them on
	const activePointIds = controlPoints
		.filter((cp) => cp.currentState)
		.map((cp) => cp.id);

	const lastTurnOnLogs =
		activePointIds.length > 0
			? await prisma.controlLog.findMany({
					where: {
						controlPointId: { in: activePointIds },
						action: "TURN_ON",
						success: true,
					},
					orderBy: { createdAt: "desc" },
					distinct: ["controlPointId"],
					select: {
						controlPointId: true,
						user: { select: { name: true } },
					},
				})
			: [];

	const lastUserByPointId = new Map(
		lastTurnOnLogs.map((log) => [log.controlPointId, log.user.name]),
	);

	// Get upcoming reservations for each control point
	const now = new Date();
	const upcomingReservations = await prisma.reservation.findMany({
		where: {
			controlPointId: { in: controlPointIds },
			status: { in: ["PENDING", "ACTIVE"] },
			endTime: { gte: now },
		},
		select: {
			id: true,
			controlPointId: true,
			startTime: true,
			endTime: true,
			status: true,
			user: { select: { name: true } },
		},
		orderBy: { startTime: "asc" },
	});

	// Group reservations by control point, keeping only the nearest one
	const nextReservationByPointId = new Map<
		string,
		{ userName: string; startTime: Date; endTime: Date; status: string }
	>();
	for (const res of upcomingReservations) {
		if (!nextReservationByPointId.has(res.controlPointId)) {
			nextReservationByPointId.set(res.controlPointId, {
				userName: res.user.name,
				startTime: res.startTime,
				endTime: res.endTime,
				status: res.status,
			});
		}
	}

	const controlPointsWithUser = controlPoints.map((cp) => ({
		...cp,
		currentUserName: lastUserByPointId.get(cp.id) ?? null,
		nextReservation: nextReservationByPointId.get(cp.id) ?? null,
	}));

	return {
		controlPoints: controlPointsWithUser,
		deviceName: ctx.device.name,
	};
}
