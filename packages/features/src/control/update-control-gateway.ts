/**
 * Control Gateways - Update
 */

import type { ControlAction } from "@ecehive/prisma";
import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";

export interface UpdateControlGatewayActionInput {
	controlPointId: string;
	action: "TURN_ON" | "TURN_OFF" | "UNLOCK";
}

export interface UpdateControlGatewayInput {
	id: number;
	name?: string;
	description?: string | null;
	isActive?: boolean;
	actions?: UpdateControlGatewayActionInput[];
}

/**
 * Updates an existing control gateway
 */
export async function updateControlGateway(input: UpdateControlGatewayInput) {
	const existing = await prisma.controlGateway.findUnique({
		where: { id: input.id },
	});

	if (!existing) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Control gateway not found",
		});
	}

	// Validate actions if being updated
	if (input.actions && input.actions.length > 0) {
		const controlPointIds = Array.from(
			new Set(input.actions.map((a) => a.controlPointId)),
		);
		const existingPoints = await prisma.controlPoint.findMany({
			where: { id: { in: controlPointIds } },
			select: { id: true, controlClass: true },
		});

		const existingIds = new Set(existingPoints.map((p) => p.id));
		const missingIds = controlPointIds.filter((id) => !existingIds.has(id));
		if (missingIds.length > 0) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: `Control points not found: ${missingIds.join(", ")}`,
			});
		}

		// Validate action compatibility with control class
		for (const action of input.actions) {
			const point = existingPoints.find((p) => p.id === action.controlPointId);
			if (!point) continue;

			if (point.controlClass === "DOOR" && action.action !== "UNLOCK") {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: `Door control points can only use the UNLOCK action (point: ${action.controlPointId})`,
				});
			}

			if (
				point.controlClass === "SWITCH" &&
				action.action !== "TURN_ON" &&
				action.action !== "TURN_OFF"
			) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: `Switch control points can only use TURN_ON or TURN_OFF actions (point: ${action.controlPointId})`,
				});
			}
		}
	}

	// Use a transaction to update gateway and replace actions atomically
	const gateway = await prisma.$transaction(async (tx) => {
		// Update gateway properties
		const updated = await tx.controlGateway.update({
			where: { id: input.id },
			data: {
				name: input.name,
				description: input.description,
				isActive: input.isActive,
			},
		});

		// If actions are provided, replace all existing actions
		if (input.actions !== undefined) {
			await tx.controlGatewayAction.deleteMany({
				where: { gatewayId: input.id },
			});

			if (input.actions.length > 0) {
				await tx.controlGatewayAction.createMany({
					data: input.actions.map((a) => ({
						gatewayId: input.id,
						controlPointId: a.controlPointId,
						action: a.action as ControlAction,
					})),
				});
			}
		}

		return tx.controlGateway.findUnique({
			where: { id: updated.id },
			include: {
				actions: {
					include: {
						controlPoint: {
							select: {
								id: true,
								name: true,
								controlClass: true,
							},
						},
					},
				},
			},
		});
	});

	if (!gateway) {
		throw new TRPCError({
			code: "INTERNAL_SERVER_ERROR",
			message: "Failed to update control gateway",
		});
	}

	// Redact access token
	return {
		...gateway,
		accessToken: `****${gateway.accessToken.slice(-4)}`,
	};
}
