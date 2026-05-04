/**
 * Control Kiosk Routes - Update Control Point
 *
 * This route allows kiosk users to enable or disable a control point on the
 * current kiosk device when they are authorized to manage that point.
 */

import { createAuditLogEntry, findUserByCard } from "@ecehive/features";
import type { ControlProviderType } from "@ecehive/prisma";
import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { TControlProtectedProcedureContext } from "../../trpc";
import { getControlProvider } from "../control/providers";

export const ZUpdatePointSchema = z.object({
	cardNumber: z.string().regex(/^\d+$/),
	controlPointId: z.string().uuid(),
	isActive: z.boolean(),
});

type UpdatePointOptions = {
	ctx: TControlProtectedProcedureContext;
	input: z.infer<typeof ZUpdatePointSchema>;
};

export async function updatePointHandler({ ctx, input }: UpdatePointOptions) {
	const { cardNumber, controlPointId, isActive } = input;

	const user = await findUserByCard(cardNumber);

	const userWithRoles = await prisma.user.findUniqueOrThrow({
		where: { id: user.id },
		include: {
			roles: { select: { id: true } },
		},
	});

	const deviceControlPoint = ctx.device.controlPoints.find(
		(cp) => cp.id === controlPointId,
	);

	if (!deviceControlPoint) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "This control point is not available on this device.",
		});
	}

	const point = await prisma.controlPoint.findUnique({
		where: { id: controlPointId },
		include: {
			provider: true,
			trainerRole: { select: { id: true } },
		},
	});

	if (!point) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Control point not found",
		});
	}

	const userRoleIds = userWithRoles.roles.map((role) => role.id);
	const isSystemUser = userWithRoles.isSystemUser;

	if (!isSystemUser) {
		const hasTrainerRole =
			point.trainerRole !== null && userRoleIds.includes(point.trainerRole.id);
		const hasUniversalTrainerPermission =
			(await prisma.role.count({
				where: {
					id: { in: userRoleIds },
					permissions: { some: { name: "control.points.universalTrainer" } },
				},
			})) > 0;

		if (!hasTrainerRole && !hasUniversalTrainerPermission) {
			throw new TRPCError({
				code: "FORBIDDEN",
				message: "You are not authorized to manage this control point",
			});
		}
	}

	if (!isActive && point.controlClass === "SWITCH" && point.currentState) {
		const lastTurnOnLog = await prisma.controlLog.findFirst({
			where: {
				controlPointId: point.id,
				action: "TURN_ON",
				success: true,
			},
			orderBy: { createdAt: "desc" },
			include: {
				user: {
					select: {
						id: true,
						username: true,
					},
				},
			},
		});

		const systemUser = await prisma.user.findFirst({
			where: { isSystemUser: true },
			select: { id: true, username: true },
		});

		const effectiveUser = lastTurnOnLog?.user ?? systemUser;

		if (!effectiveUser) {
			throw new TRPCError({
				code: "INTERNAL_SERVER_ERROR",
				message: "Unable to locate a user for tool logout logging",
			});
		}

		const provider = getControlProvider(
			point.provider.providerType as ControlProviderType,
		);

		const operationResult = await provider.writeState(
			point.provider.config,
			point.providerConfig,
			false,
			effectiveUser.username,
		);

		await prisma.controlLog.create({
			data: {
				controlPointId: point.id,
				userId: effectiveUser.id,
				action: "TURN_OFF",
				previousState: point.currentState,
				newState: operationResult.success ? false : null,
				success: operationResult.success,
				errorMessage: operationResult.success
					? "Auto logout before deactivation"
					: operationResult.errorMessage,
			},
		});

		if (!operationResult.success) {
			throw new TRPCError({
				code: "INTERNAL_SERVER_ERROR",
				message:
					operationResult.errorMessage ??
					"Failed to turn off control point before deactivation",
			});
		}

		await prisma.controlPoint.update({
			where: { id: point.id },
			data: { currentState: false },
		});
	}

	const updatedPoint = await prisma.controlPoint.update({
		where: { id: controlPointId },
		data: { isActive },
		select: {
			id: true,
			isActive: true,
		},
	});

	await createAuditLogEntry({
		userId: user.id,
		source: "trpc",
		action: "controlKiosk.updatePoint",
		metadata: {
			controlPointId,
			controlPointName: point.name,
			isActive,
		},
	});

	return updatedPoint;
}
