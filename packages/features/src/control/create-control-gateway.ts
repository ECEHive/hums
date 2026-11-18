/**
 * Control Gateways - Create
 */

import type { ControlAction } from "@ecehive/prisma";
import { prisma } from "@ecehive/prisma";
import {
	type GatewayActionInput,
	validateGatewayActions,
} from "./validate-gateway-actions";

export interface CreateControlGatewayInput {
	name: string;
	description?: string;
	isActive?: boolean;
	actions: GatewayActionInput[];
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
	await validateGatewayActions(input.actions);

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
