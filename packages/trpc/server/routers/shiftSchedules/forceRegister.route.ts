import {
	assertCanAccessPeriod,
	assignUserToScheduleOccurrences,
	getShiftScheduleForRegistration,
	getUserWithRoles,
	lockShiftSchedule,
	shiftScheduleEvents,
} from "@ecehive/features";
import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZForceRegisterSchema = z.object({
	shiftScheduleId: z.number().min(1),
	userId: z.number().min(1),
});

export type TForceRegisterSchema = z.infer<typeof ZForceRegisterSchema>;

export type TForceRegisterOptions = {
	ctx: TPermissionProtectedProcedureContext;
	input: TForceRegisterSchema;
};

export async function forceRegisterHandler(options: TForceRegisterOptions) {
	const { shiftScheduleId, userId } = options.input;

	const actor = await getUserWithRoles(prisma, options.ctx.user.id);

	if (!actor) {
		throw new TRPCError({
			code: "UNAUTHORIZED",
			message: "User not found",
		});
	}

	const actorRoleIds = new Set(actor.roles.map((role) => role.id));
	let emittedPeriodId = 0;

	await prisma.$transaction(async (tx) => {
		const isLocked = await lockShiftSchedule(tx, shiftScheduleId);

		if (!isLocked) {
			throw new TRPCError({
				code: "NOT_FOUND",
				message: "Shift schedule not found",
			});
		}

		const schedule = await getShiftScheduleForRegistration(tx, shiftScheduleId);

		if (!schedule) {
			throw new TRPCError({
				code: "NOT_FOUND",
				message: "Shift schedule not found",
			});
		}

		emittedPeriodId = schedule.shiftType.periodId;

		const period = await tx.period.findUnique({
			where: { id: schedule.shiftType.periodId },
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

		const targetUser = await tx.user.findUnique({
			where: { id: userId },
			include: {
				roles: { select: { id: true } },
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

		if (schedule.users.some((user) => user.id === userId)) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "User is already registered for this shift",
			});
		}

		if (schedule.users.length >= schedule.slots) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "All slots for this shift schedule are filled",
			});
		}

		await tx.shiftSchedule.update({
			where: { id: shiftScheduleId },
			data: {
				users: {
					connect: { id: userId },
				},
			},
		});

		await assignUserToScheduleOccurrences(tx, shiftScheduleId, userId);
	});

	shiftScheduleEvents.emitUpdate({
		type: "register",
		shiftScheduleId,
		userId,
		periodId: emittedPeriodId,
		timestamp: new Date(),
	});

	return { success: true };
}
