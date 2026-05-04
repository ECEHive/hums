/**
 * Control Kiosk Routes - Get Control Logs
 *
 * Returns recent control logs for a control point on the kiosk device.
 */

import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { TControlProtectedProcedureContext } from "../../trpc";

export const ZGetControlLogsSchema = z.object({
	controlPointId: z.string().uuid(),
	limit: z.number().int().min(1).max(200).default(50),
});

type GetControlLogsOptions = {
	ctx: TControlProtectedProcedureContext;
	input: z.infer<typeof ZGetControlLogsSchema>;
};

export async function getControlLogsHandler({
	ctx,
	input,
}: GetControlLogsOptions) {
	const { controlPointId, limit } = input;

	const deviceControlPoint = ctx.device.controlPoints.find(
		(cp) => cp.id === controlPointId,
	);

	if (!deviceControlPoint) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "This control point is not available on this device.",
		});
	}

	const logs = await prisma.controlLog.findMany({
		where: {
			controlPointId,
			action: { in: ["TURN_ON", "TURN_OFF", "UNLOCK"] },
		},
		orderBy: { createdAt: "desc" },
		take: limit,
		select: {
			id: true,
			action: true,
			createdAt: true,
			user: { select: { name: true } },
		},
	});

	return {
		logs: logs.map((log) => ({
			id: log.id,
			action: log.action === "TURN_OFF" ? "logout" : "login",
			createdAt: log.createdAt,
			userName: log.user?.name ?? "Unknown User",
		})),
	};
}
