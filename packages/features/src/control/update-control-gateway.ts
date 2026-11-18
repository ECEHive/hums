/**
 * Control Gateways - Update
 */

import type { ControlAction } from "@ecehive/prisma";
import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import {
	type GatewayActionInput,
	validateGatewayActions,
} from "./validate-gateway-actions";

export interface UpdateControlGatewayInput {
	id: number;
	name?: string;
	description?: string | null;
	isActive?: boolean;
	actions?: GatewayActionInput[];
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

	if (input.actions) await validateGatewayActions(input.actions);

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
