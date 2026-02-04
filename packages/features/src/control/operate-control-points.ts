import type { ControlAction, ControlProviderType } from "@ecehive/prisma";
import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import { getControlProvider } from "./providers";

export type OperateControlPointOptions = {
	controlPointId: string;
	username: string;
	state: boolean;
};

export type OperateControlPointByUserIdOptions = {
	controlPointId: string;
	userId: number;
	isSystemUser: boolean;
	username: string;
	action: "TURN_ON" | "TURN_OFF" | "UNLOCK";
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

export async function operateControlPoint(
	options: OperateControlPointOptions,
): Promise<OperateControlPointResult> {
	const { controlPointId, username, state } = options;

	const user = await validateUserExists(username);

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

	if (!point.isActive) {
		throw new TRPCError({
			code: "PRECONDITION_FAILED",
			message: "Control point is not active",
		});
	}

	if (!point.provider.isActive) {
		throw new TRPCError({
			code: "PRECONDITION_FAILED",
			message: "Control provider is not active",
		});
	}

	if (!point.canControlOnline) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "This control point cannot be controlled online",
		});
	}

	if (!user.isSystemUser) {
		const userRoleIds = user.roles.map((r) => r.id);

		const isDirectlyAuthorized = point.authorizedUsers.some(
			(u) => u.id === user.id,
		);
		const isRoleAuthorized = point.authorizedRoles.some((r) =>
			userRoleIds.includes(r.id),
		);

		const hasNoRestrictions =
			point.authorizedUsers.length === 0 && point.authorizedRoles.length === 0;

		if (!isDirectlyAuthorized && !isRoleAuthorized && !hasNoRestrictions) {
			throw new TRPCError({
				code: "FORBIDDEN",
				message: "User is not authorized to control this equipment",
			});
		}
	}

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
		action = state ? "TURN_ON" : "TURN_OFF";
	}

	const provider = getControlProvider(
		point.provider.providerType as ControlProviderType,
	);

	const operationResult = await provider.writeState(
		point.provider.config,
		point.providerConfig,
		state,
		username,
	);

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

export async function operateControlPointByUserId(
	options: OperateControlPointByUserIdOptions,
): Promise<OperateControlPointResult> {
	const { controlPointId, userId, isSystemUser, username, action } = options;

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

	if (!point.isActive) {
		throw new TRPCError({
			code: "PRECONDITION_FAILED",
			message: "Control point is not active",
		});
	}

	if (!point.provider.isActive) {
		throw new TRPCError({
			code: "PRECONDITION_FAILED",
			message: "Control provider is not active",
		});
	}

	if (!point.canControlOnline) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "This control point cannot be controlled online",
		});
	}

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

		const hasNoRestrictions =
			point.authorizedUsers.length === 0 && point.authorizedRoles.length === 0;

		if (!isDirectlyAuthorized && !isRoleAuthorized && !hasNoRestrictions) {
			throw new TRPCError({
				code: "FORBIDDEN",
				message: "You are not authorized to control this equipment",
			});
		}
	}

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

	const provider = getControlProvider(
		point.provider.providerType as ControlProviderType,
	);

	const targetState = action === "TURN_ON" || action === "UNLOCK";

	const operationResult = await provider.writeState(
		point.provider.config,
		point.providerConfig,
		targetState,
		username,
	);

	const logEntry = await prisma.controlLog.create({
		data: {
			controlPointId: point.id,
			userId: userId,
			action: action as ControlAction,
			previousState: point.currentState,
			newState: operationResult.success ? targetState : null,
			success: operationResult.success,
			errorMessage: operationResult.errorMessage,
		},
	});

	if (operationResult.success && point.controlClass === "SWITCH") {
		await prisma.controlPoint.update({
			where: { id: point.id },
			data: { currentState: targetState },
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
		username,
		action: action as ControlAction,
		previousState: point.currentState,
		newState: targetState,
		logId: logEntry.id,
	};
}
