import {
	assertCanAccessPeriod,
	getShiftSchedulesForListing,
	getUserWithRoles,
} from "@ecehive/features";
import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZListForUserManagementSchema = z.object({
	periodId: z.number().min(1),
	userId: z.number().min(1),
	dayOfWeek: z.number().min(0).max(6).optional(),
});

export type TListForUserManagementSchema = z.infer<
	typeof ZListForUserManagementSchema
>;

export type TListForUserManagementOptions = {
	ctx: TPermissionProtectedProcedureContext;
	input: TListForUserManagementSchema;
};

export async function listForUserManagementHandler(
	options: TListForUserManagementOptions,
) {
	const { periodId, userId, dayOfWeek } = options.input;

	const actor = await getUserWithRoles(prisma, options.ctx.user.id);

	if (!actor) {
		throw new TRPCError({
			code: "UNAUTHORIZED",
			message: "User not found",
		});
	}

	const actorRoleIds = new Set(actor.roles.map((role) => role.id));

	const period = await prisma.period.findUnique({
		where: { id: periodId },
		include: {
			roles: { select: { id: true } },
		},
	});

	if (!period) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Period not found",
		});
	}

	assertCanAccessPeriod(period, actorRoleIds, {
		isSystemUser: options.ctx.user.isSystemUser,
	});

	const targetUser = await prisma.user.findUnique({
		where: { id: userId },
		include: {
			roles: {
				select: { id: true, name: true },
			},
		},
	});

	if (!targetUser) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Target user not found",
		});
	}

	const requiredRoleIds = period.roles.map((role) => role.id);

	if (
		requiredRoleIds.length > 0 &&
		!targetUser.roles.some((role) => requiredRoleIds.includes(role.id))
	) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "User is not eligible for this period",
		});
	}

	const schedules = await getShiftSchedulesForListing(prisma, {
		shiftType: { periodId },
		...(dayOfWeek !== undefined ? { dayOfWeek } : {}),
	});

	const scheduleSummaries = schedules.map((schedule) => {
		const assignedUsers = schedule.users.length;
		const isRegistered = schedule.users.some((user) => user.id === userId);
		const availableSlots = schedule.slots - assignedUsers;

		return {
			id: schedule.id,
			shiftTypeId: schedule.shiftTypeId,
			shiftTypeName: schedule.shiftType.name,
			shiftTypeColor: schedule.shiftType.color,
			shiftTypeLocation: schedule.shiftType.location,
			dayOfWeek: schedule.dayOfWeek,
			startTime: schedule.startTime,
			endTime: schedule.endTime,
			slots: schedule.slots,
			assignedUserCount: assignedUsers,
			availableSlots,
			isRegistered,
		};
	});

	return {
		period: {
			id: period.id,
			name: period.name,
		},
		user: {
			id: targetUser.id,
			name: targetUser.name ?? targetUser.username,
			roles: targetUser.roles,
		},
		schedules: scheduleSummaries,
	};
}
