import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";

// ControlAction type from Prisma enum (generated when prisma generate is run)
type ControlAction = "TURN_ON" | "TURN_OFF" | "UNLOCK" | "READ_STATE";

export type OperateControlPointOptions = {
	/** The UUID of the control point */
	controlPointId: string;
	/** The username of the user performing the operation */
	username: string;
	/** The target state (true = on/unlock, false = off) */
	state: boolean;
};

export type OperateControlPointResult = {
	success: boolean;
	controlPointId: string;
	username: string;
	action: ControlAction;
	previousState: boolean | null;
	newState: boolean | null;
	logId: string;
	errorMessage?: string;
};

/**
 * Validates that a user exists by username.
 *
 * @param username - The username to validate
 * @returns The user if found
 * @throws TRPCError with NOT_FOUND if user doesn't exist
 */
export async function validateUserExists(username: string) {
	const user = await prisma.user.findUnique({
		where: { username },
		select: {
			id: true,
			username: true,
			name: true,
			isSystemUser: true,
			roles: {
				select: { id: true, name: true },
			},
		},
	});

	if (!user) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: `User not found: ${username}`,
		});
	}

	return user;
}

/**
 * Finds a user by username, returning null if not found (no throw).
 *
 * @param username - The username to find
 * @returns The user or null if not found
 */
export async function findUserByUsername(username: string) {
	return prisma.user.findUnique({
		where: { username },
		select: {
			id: true,
			username: true,
			name: true,
			isSystemUser: true,
			roles: {
				select: { id: true, name: true },
			},
		},
	});
}

/**
 * Operates a control point (switch or door) to a specified state.
 *
 * This function validates:
 * 1. The user exists
 * 2. The control point exists and is active
 * 3. The provider is active
 * 4. The action is valid for the control class
 *
 * Note: Authorization checks and actual hardware control are delegated
 * to the control provider implementation.
 *
 * @param options - The operation options
 * @returns The result of the operation including the log entry ID
 * @throws TRPCError if validation fails or operation cannot be completed
 */
export async function operateControlPoint(
	options: OperateControlPointOptions,
): Promise<OperateControlPointResult> {
	const { controlPointId, username, state } = options;

	// 1. Validate user exists
	const user = await validateUserExists(username);

	// 2. Get the control point with provider info
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

	// 3. Check if control point is active
	if (!point.isActive) {
		throw new TRPCError({
			code: "PRECONDITION_FAILED",
			message: "Control point is not active",
		});
	}

	// 4. Check if provider is active
	if (!point.provider.isActive) {
		throw new TRPCError({
			code: "PRECONDITION_FAILED",
			message: "Control provider is not active",
		});
	}

	// 5. Check if online control is allowed
	if (!point.canControlOnline) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "This control point cannot be controlled online",
		});
	}

	// 6. Check user authorization (unless system user)
	if (!user.isSystemUser) {
		const userRoleIds = user.roles.map((r) => r.id);

		const isDirectlyAuthorized = point.authorizedUsers.some(
			(u) => u.id === user.id,
		);
		const isRoleAuthorized = point.authorizedRoles.some((r) =>
			userRoleIds.includes(r.id),
		);

		// If there are no restrictions, anyone can use it
		const hasNoRestrictions =
			point.authorizedUsers.length === 0 && point.authorizedRoles.length === 0;

		if (!isDirectlyAuthorized && !isRoleAuthorized && !hasNoRestrictions) {
			throw new TRPCError({
				code: "FORBIDDEN",
				message: "User is not authorized to control this equipment",
			});
		}
	}

	// 7. Determine the action based on control class and target state
	let action: ControlAction;
	if (point.controlClass === "DOOR") {
		if (!state) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message:
					"Door control points can only be unlocked (state must be true)",
			});
		}
		action = "UNLOCK";
	} else {
		// SWITCH
		action = state ? "TURN_ON" : "TURN_OFF";
	}

	// 8. Perform the control operation
	// TODO: The actual hardware control will be implemented by another team member
	// For now, we'll create a log entry and simulate success
	//
	// Example of how this would work with a real provider:
	// const provider = getControlProvider(point.provider.providerType as ControlProviderType);
	// const result = await provider.writeState(
	//   point.provider.config,
	//   point.providerConfig,
	//   state,
	//   username,
	// );

	// Simulated result (replace with actual provider call)
	const operationResult = {
		success: true,
		errorMessage: undefined as string | undefined,
	};

	// 9. Log the operation
	const logEntry = await prisma.controlLog.create({
		data: {
			controlPointId: point.id,
			userId: user.id,
			action,
			previousState: point.currentState,
			newState: operationResult.success ? state : null,
			success: operationResult.success,
			errorMessage: operationResult.errorMessage,
		},
	});

	// 10. Update the current state if successful (for switches)
	if (operationResult.success && point.controlClass === "SWITCH") {
		await prisma.controlPoint.update({
			where: { id: point.id },
			data: { currentState: state },
		});
	}

	if (!operationResult.success) {
		throw new TRPCError({
			code: "INTERNAL_SERVER_ERROR",
			message: operationResult.errorMessage ?? "Failed to control equipment",
		});
	}

	return {
		success: true,
		controlPointId: point.id,
		username: user.username,
		action,
		previousState: point.currentState,
		newState: state,
		logId: logEntry.id,
	};
}
