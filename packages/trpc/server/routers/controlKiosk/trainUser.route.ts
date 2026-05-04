/**
 * Control Kiosk Routes - Train User
 *
 * Grants the trained role for a control point when a trainer scans a user's card.
 */

import { createAuditLogEntry, findUserByCard } from "@ecehive/features";
import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { TControlProtectedProcedureContext } from "../../trpc";

export const ZTrainUserSchema = z.object({
	trainerCardNumber: z.string().regex(/^\d+$/),
	traineeCardNumber: z.string().regex(/^\d+$/),
	controlPointId: z.string().uuid(),
});

type TrainUserOptions = {
	ctx: TControlProtectedProcedureContext;
	input: z.infer<typeof ZTrainUserSchema>;
};

export async function trainUserHandler({ ctx, input }: TrainUserOptions) {
	const { trainerCardNumber, traineeCardNumber, controlPointId } = input;

	const trainer = await findUserByCard(trainerCardNumber);
	const trainee = await findUserByCard(traineeCardNumber);

	if (trainer.id === trainee.id) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "You cannot train yourself.",
		});
	}

	const trainerWithRoles = await prisma.user.findUniqueOrThrow({
		where: { id: trainer.id },
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
			trainerRole: { select: { id: true, name: true } },
			trainedRole: { select: { id: true, name: true } },
		},
	});

	if (!point) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Control point not found",
		});
	}

	if (!point.trainedRole) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "No trained role is configured for this control point.",
		});
	}

	const userRoleIds = trainerWithRoles.roles.map((role) => role.id);
	const isSystemUser = trainerWithRoles.isSystemUser;

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
				message:
					"You are not authorized to train users for this control point.",
			});
		}
	}

	const traineeWithRoles = await prisma.user.findUniqueOrThrow({
		where: { id: trainee.id },
		include: {
			roles: { select: { id: true } },
		},
	});

	const alreadyTrained = traineeWithRoles.roles.some(
		(role) => role.id === point.trainedRole?.id,
	);

	if (alreadyTrained) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "User is already trained for this control point.",
		});
	}

	await prisma.user.update({
		where: { id: trainee.id },
		data: {
			roles: {
				connect: {
					id: point.trainedRole.id,
				},
			},
		},
	});

	await createAuditLogEntry({
		userId: trainer.id,
		source: "trpc",
		action: "controlKiosk.trainUser",
		metadata: {
			controlPointId: controlPointId,
			controlPointName: point.name,
			trainerId: trainer.id,
			trainerName: trainer.name,
			traineeId: trainee.id,
			traineeName: trainee.name,
			trainedRoleId: point.trainedRole.id,
			trainedRoleName: point.trainedRole.name,
		},
	});

	return {
		userId: trainee.id,
		userName: trainee.name,
	};
}
