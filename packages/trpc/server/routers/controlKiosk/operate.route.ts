/**
 * Control Kiosk Routes - Operate
 *
 * This route handles control point operations from the control kiosk.
 * It verifies that the user (identified by card number) has permission to operate
 * the specific control point that is assigned to the device.
 */

import type { ControlAction, ControlProviderType } from "@ecehive/prisma";
import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { TControlProtectedProcedureContext } from "../../trpc";
import { getControlProvider } from "../control/providers";

export const ZKioskOperateSchema = z.object({
	cardNumber: z.string().regex(/^\d+$/),
	controlPointId: z.string().uuid(),
	action: z.enum(["TURN_ON", "TURN_OFF", "UNLOCK"]),
});

type KioskOperateOptions = {
	ctx: TControlProtectedProcedureContext;
	input: z.infer<typeof ZKioskOperateSchema>;
};

export async function kioskOperateHandler({ ctx, input }: KioskOperateOptions) {
	const { cardNumber, controlPointId, action } = input;

	// Find the user by card number
	const user = await prisma.user.findFirst({
		where: { cardNumber },
		include: {
			roles: { select: { id: true } },
		},
	});

	if (!user) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "User not found. Please ensure your card is registered.",
		});
	}

	// Verify the control point is assigned to this device
	const deviceControlPoint = ctx.device.controlPoints.find(
		(cp) => cp.id === controlPointId,
	);

	if (!deviceControlPoint) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "This control point is not available on this device.",
		});
	}

	// Get the full control point with provider info
	const point = await prisma.controlPoint.findUnique({
		where: { id: controlPointId },
		include: {
			provider: true,
			authorizedRoles: { select: { id: true } },
			authorizedUsers: { select: { id: true } },
		},
	});

	if (!point) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Control point not found",
		});
	}

	// Check if the control point is active
	if (!point.isActive) {
		throw new TRPCError({
			code: "PRECONDITION_FAILED",
			message: "Control point is not active",
		});
	}

	// Check if the provider is active
	if (!point.provider.isActive) {
		throw new TRPCError({
			code: "PRECONDITION_FAILED",
			message: "Control provider is not active",
		});
	}

	// Check authorization - user must be authorized directly or through a role
	const userRoleIds = user.roles.map((r) => r.id);
	const isSystemUser = user.isSystemUser;

	// System users bypass all authorization checks
	if (!isSystemUser) {
		const isDirectlyAuthorized = point.authorizedUsers.some(
			(u) => u.id === user.id,
		);
		const isRoleAuthorized = point.authorizedRoles.some((r) =>
			userRoleIds.includes(r.id),
		);

		// If there are no authorized users/roles, anyone can use it
		const hasNoRestrictions =
			point.authorizedUsers.length === 0 && point.authorizedRoles.length === 0;

		if (!isDirectlyAuthorized && !isRoleAuthorized && !hasNoRestrictions) {
			throw new TRPCError({
				code: "FORBIDDEN",
				message: "You are not authorized to control this equipment",
			});
		}
	}

	// Validate action for control class
	if (point.controlClass === "DOOR" && action !== "UNLOCK") {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Door control points can only use the UNLOCK action",
		});
	}

	if (
		point.controlClass === "SWITCH" &&
		action !== "TURN_ON" &&
		action !== "TURN_OFF"
	) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Switch control points can only use TURN_ON or TURN_OFF actions",
		});
	}

	// Get the provider implementation
	const provider = getControlProvider(
		point.provider.providerType as ControlProviderType,
	);

	// Determine the target state
	const targetState = action === "TURN_ON" || action === "UNLOCK";

	// Perform the control operation
	const result = await provider.writeState(
		point.provider.config,
		point.providerConfig,
		targetState,
		user.username,
	);

	// Log the operation
	const logEntry = await prisma.controlLog.create({
		data: {
			controlPointId: point.id,
			userId: user.id,
			action: action as ControlAction,
			previousState: point.currentState,
			newState: result.success ? targetState : null,
			success: result.success,
			errorMessage: result.errorMessage,
		},
	});

	// Update the current state if successful (for switches)
	if (result.success && point.controlClass === "SWITCH") {
		await prisma.controlPoint.update({
			where: { id: point.id },
			data: { currentState: targetState },
		});
	}

	if (!result.success) {
		throw new TRPCError({
			code: "INTERNAL_SERVER_ERROR",
			message: result.errorMessage ?? "Failed to control equipment",
		});
	}

	return {
		success: true,
		newState: targetState,
		logId: logEntry.id,
		userName: user.name,
	};
}
