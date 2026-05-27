import {
	createControlPoint,
	deleteControlPoint,
	getControlPoint,
	listControlPoints,
	operateControlPointByUserId,
	readControlPointState,
	updateControlPoint,
} from "@ecehive/features";
import { z } from "zod";

export const ZCreatePointSchema = z.object({
	name: z.string().min(1).max(255),
	description: z.string().max(1000).optional(),
	location: z.string().max(255).optional(),
	controlClass: z.enum(["SWITCH", "DOOR"]),
	canControlOnline: z.boolean().optional(),
	canControlWithCode: z.boolean().optional(),
	providerId: z.number().int(),
	providerConfig: z.record(z.string(), z.unknown()),
	authorizedRoleIds: z.array(z.number().int()).optional(),
	trainedRoleId: z.number().int().optional(),
	trainerRoleId: z.number().int().optional(),
	authorizedUserIds: z.array(z.number().int()).optional(),
	autoTurnOffEnabled: z.boolean().optional(),
	autoTurnOffMinutes: z.number().int().min(1).optional().nullable(),
	isActive: z.boolean().optional(),
});

export const ZDeletePointSchema = z.object({
	id: z.string().uuid(),
});

export const ZGetPointSchema = z.object({
	id: z.string().uuid(),
});

export const ZListPointsSchema = z.object({
	search: z.string().optional(),
	providerId: z.number().int().optional(),
	controlClass: z.enum(["SWITCH", "DOOR"]).optional(),
	isActive: z.boolean().optional(),
	canControlOnline: z.boolean().optional(),
	limit: z.number().int().min(1).max(100).default(25),
	offset: z.number().int().min(0).default(0),
	sortBy: z.enum(["name", "location", "createdAt"]).default("name"),
	sortOrder: z.enum(["asc", "desc"]).default("asc"),
});

export const ZOperatePointSchema = z.object({
	id: z.string().uuid(),
	action: z.enum(["TURN_ON", "TURN_OFF", "UNLOCK"]),
});

export const ZReadStateSchema = z.object({
	id: z.string().uuid(),
});

export const ZUpdatePointSchema = z.object({
	id: z.string().uuid(),
	name: z.string().min(1).max(255).optional(),
	description: z.string().max(1000).optional().nullable(),
	location: z.string().max(255).optional().nullable(),
	controlClass: z.enum(["SWITCH", "DOOR"]).optional(),
	canControlOnline: z.boolean().optional(),
	canControlWithCode: z.boolean().optional(),
	providerId: z.number().int().optional(),
	providerConfig: z.record(z.string(), z.unknown()).optional(),
	authorizedRoleIds: z.array(z.number().int()).optional(),
	trainedRoleId: z.number().int().optional().nullable(),
	trainerRoleId: z.number().int().optional().nullable(),
	authorizedUserIds: z.array(z.number().int()).optional(),
	autoTurnOffEnabled: z.boolean().optional(),
	autoTurnOffMinutes: z.number().int().min(1).optional().nullable(),
	isActive: z.boolean().optional(),
});

export async function createPointHandler({
	input,
}: {
	input: z.infer<typeof ZCreatePointSchema>;
}) {
	return createControlPoint(input);
}

export async function deletePointHandler({
	input,
}: {
	input: z.infer<typeof ZDeletePointSchema>;
}) {
	return deleteControlPoint(input.id);
}

export async function getPointHandler({
	input,
}: {
	input: z.infer<typeof ZGetPointSchema>;
}) {
	return getControlPoint(input.id);
}

export async function listPointsHandler({
	input,
}: {
	input: z.infer<typeof ZListPointsSchema>;
}) {
	return listControlPoints(input);
}

import type { TProtectedProcedureContext } from "@ecehive/trpc/server";
export async function operatePointHandler({
	ctx,
	input,
}: {
	ctx: TProtectedProcedureContext;
	input: z.infer<typeof ZOperatePointSchema>;
}) {
	const result = await operateControlPointByUserId({
		controlPointId: input.id,
		userId: ctx.user.id,
		isSystemUser: ctx.user.isSystemUser,
		username: ctx.user.username,
		action: input.action,
	});
	return {
		success: result.success,
		newState: result.newState,
		logId: result.logId,
	};
}

export async function readStateHandler({
	input,
}: {
	input: z.infer<typeof ZReadStateSchema>;
}) {
	return readControlPointState(input.id);
}

export async function updatePointHandler({
	input,
}: {
	input: z.infer<typeof ZUpdatePointSchema>;
}) {
	return updateControlPoint(input);
}
