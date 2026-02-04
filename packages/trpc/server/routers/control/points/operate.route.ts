/**
 * Control Points Routes - Operate
 *
 * This route handles the actual control operations (turn on, turn off, unlock)
 */

import type { ControlAction, ControlProviderType } from "@ecehive/prisma";
import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { TProtectedProcedureContext } from "../../../trpc";
import { getControlProvider } from "../providers";

export const ZOperatePointSchema = z.object({
	id: z.string().uuid(),
	action: z.enum(["TURN_ON", "TURN_OFF", "UNLOCK"]),
});

type OperatePointOptions = {
	ctx: TProtectedProcedureContext;
	input: z.infer<typeof ZOperatePointSchema>;
};

export async function operatePointHandler({ ctx, input }: OperatePointOptions) {
	// Get the control point with provider and authorization info
	const point = await prisma.controlPoint.findUnique({
		where: { id: input.id },
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

	// Check if online control is allowed (for web portal access)
	if (!point.canControlOnline) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "This control point cannot be controlled online",
		});
	}

	// Check authorization - user must be authorized directly or through a role
	// System users are considered to have all roles
	const userId = ctx.user.id;
	const isSystemUser = ctx.user.isSystemUser;

	// System users bypass all authorization checks
	if (!isSystemUser) {
		const userRoles = await prisma.role.findMany({
			where: {
				users: { some: { id: userId } },
			},
			select: { id: true },
		});

		const isDirectlyAuthorized = point.authorizedUsers.some(
			(u) => u.id === userId,
		);
		const isRoleAuthorized = point.authorizedRoles.some((r) =>
			userRoles.some((ur) => ur.id === r.id),
		);

		// If there are no authorized users/roles, anyone with operate permission can use it
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
	if (point.controlClass === "DOOR" && input.action !== "UNLOCK") {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Door control points can only use the UNLOCK action",
		});
	}

	if (
		point.controlClass === "SWITCH" &&
		input.action !== "TURN_ON" &&
		input.action !== "TURN_OFF"
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
	const targetState = input.action === "TURN_ON" || input.action === "UNLOCK";

	// Perform the control operation
	const result = await provider.writeState(
		point.provider.config,
		point.providerConfig,
		targetState,
		ctx.user.username,
	);

	// Log the operation
	const logEntry = await prisma.controlLog.create({
		data: {
			controlPointId: point.id,
			userId: ctx.user.id,
			action: input.action as ControlAction,
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
	};
}
