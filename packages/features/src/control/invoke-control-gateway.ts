/**
 * Control Gateways - Invoke
 *
 * Handles the invocation of a control gateway. When called with
 * an access token and a credential value, it:
 * 1. Finds the gateway by access token
 * 2. Finds the user by credential hash
 * 3. Checks which gateway actions the user is authorized to perform
 * 4. Executes authorized actions on the control points
 */

import type { ControlAction, ControlProviderType } from "@ecehive/prisma";
import { prisma } from "@ecehive/prisma";
import { hashCredential } from "../credentials/hash";
import { getControlProvider } from "./providers";

export interface InvokeControlGatewayInput {
	accessToken: string;
	credentialValue: string;
}

export interface GatewayActionResult {
	controlPointId: string;
	controlPointName: string;
	action: ControlAction;
	success: boolean;
	error?: string;
	skipped?: boolean;
	skipReason?: string;
}

export interface InvokeControlGatewayResult {
	gatewayId: number;
	gatewayName: string;
	userId: number;
	username: string;
	results: GatewayActionResult[];
}

/**
 * Invokes a control gateway, executing authorized actions for the user
 * identified by the provided credential value
 */
export async function invokeControlGateway(
	input: InvokeControlGatewayInput,
): Promise<InvokeControlGatewayResult> {
	// Find the gateway by access token
	const gateway = await prisma.controlGateway.findUnique({
		where: { accessToken: input.accessToken },
		include: {
			actions: {
				include: {
					controlPoint: {
						include: {
							provider: true,
							authorizedRoles: { select: { id: true } },
							authorizedUsers: { select: { id: true } },
						},
					},
				},
			},
		},
	});

	if (!gateway) {
		throw new GatewayError("INVALID_TOKEN", "Invalid gateway access token");
	}

	if (!gateway.isActive) {
		throw new GatewayError("GATEWAY_INACTIVE", "This gateway is not active");
	}

	// Find user by credential hash
	const hash = hashCredential(input.credentialValue);
	const credential = await prisma.credential.findUnique({
		where: { hash },
		include: {
			user: {
				include: {
					roles: { select: { id: true } },
				},
			},
		},
	});

	if (!credential) {
		throw new GatewayError(
			"INVALID_CREDENTIAL",
			"No user found for the provided credential",
		);
	}

	const user = credential.user;
	const userRoleIds = new Set(user.roles.map((r) => r.id));

	// Execute each configured action, checking authorization per action
	const results: GatewayActionResult[] = [];

	for (const gatewayAction of gateway.actions) {
		const point = gatewayAction.controlPoint;

		// Check if control point is active
		if (!point.isActive) {
			results.push({
				controlPointId: point.id,
				controlPointName: point.name,
				action: gatewayAction.action,
				success: false,
				skipped: true,
				skipReason: "Control point is not active",
			});
			continue;
		}

		// Check if provider is active
		if (!point.provider.isActive) {
			results.push({
				controlPointId: point.id,
				controlPointName: point.name,
				action: gatewayAction.action,
				success: false,
				skipped: true,
				skipReason: "Control provider is not active",
			});
			continue;
		}

		// Check user authorization for this control point
		if (!user.isSystemUser) {
			const isDirectlyAuthorized = point.authorizedUsers.some(
				(u) => u.id === user.id,
			);
			const isRoleAuthorized = point.authorizedRoles.some((r) =>
				userRoleIds.has(r.id),
			);
			const hasNoRestrictions =
				point.authorizedUsers.length === 0 &&
				point.authorizedRoles.length === 0;

			if (!isDirectlyAuthorized && !isRoleAuthorized && !hasNoRestrictions) {
				results.push({
					controlPointId: point.id,
					controlPointName: point.name,
					action: gatewayAction.action,
					success: false,
					skipped: true,
					skipReason: "User is not authorized for this control point",
				});
				continue;
			}
		}

		// Execute the action
		try {
			const provider = getControlProvider(
				point.provider.providerType as ControlProviderType,
			);

			const targetState =
				gatewayAction.action === "TURN_ON" || gatewayAction.action === "UNLOCK";

			const operationResult = await provider.writeState(
				point.provider.config,
				point.providerConfig,
				targetState,
				user.username,
			);

			// Log the operation
			await prisma.controlLog.create({
				data: {
					controlPointId: point.id,
					userId: user.id,
					action: gatewayAction.action,
					previousState: point.currentState,
					newState: operationResult.success ? targetState : null,
					success: operationResult.success,
					errorMessage: operationResult.errorMessage,
				},
			});

			// Update control point state for switches
			if (operationResult.success && point.controlClass === "SWITCH") {
				await prisma.controlPoint.update({
					where: { id: point.id },
					data: { currentState: targetState },
				});
			}

			results.push({
				controlPointId: point.id,
				controlPointName: point.name,
				action: gatewayAction.action,
				success: operationResult.success,
				error: operationResult.errorMessage,
			});
		} catch (error) {
			results.push({
				controlPointId: point.id,
				controlPointName: point.name,
				action: gatewayAction.action,
				success: false,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	return {
		gatewayId: gateway.id,
		gatewayName: gateway.name,
		userId: user.id,
		username: user.username,
		results,
	};
}

/**
 * Structured error for gateway operations
 */
export class GatewayError extends Error {
	code: string;

	constructor(code: string, message: string) {
		super(message);
		this.name = "GatewayError";
		this.code = code;
	}
}
