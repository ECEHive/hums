/**
 * Control Gateways - Create
 */

import type { ControlAction } from "@ecehive/prisma";
import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";

export interface CreateControlGatewayActionInput {
	controlPointId: string;
	action: "TURN_ON" | "TURN_OFF" | "UNLOCK";
}

export interface CreateControlGatewayInput {
	name: string;
	description?: string;
	isActive?: boolean;
	actions: CreateControlGatewayActionInput[];
}

/**
 * Generates a cryptographically secure access token for a gateway
 */
function generateAccessToken(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(32));
	return Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

/**
 * Creates a new control gateway with associated actions
 */
export async function createControlGateway(input: CreateControlGatewayInput) {
	// Validate that all referenced control points exist
	if (input.actions.length > 0) {
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

	const accessToken = generateAccessToken();

	const gateway = await prisma.controlGateway.create({
		data: {
			name: input.name,
			description: input.description,
			accessToken,
			isActive: input.isActive ?? true,
			actions: {
				create: input.actions.map((a) => ({
					controlPointId: a.controlPointId,
					action: a.action as ControlAction,
				})),
			},
		},
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

	return gateway;
}
