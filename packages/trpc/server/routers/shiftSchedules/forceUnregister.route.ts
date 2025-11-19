import {
	assertCanAccessPeriod,
	getShiftScheduleForRegistration,
	getUserWithRoles,
	lockShiftSchedule,
	shiftScheduleEvents,
	unassignUserFromScheduleOccurrences,
} from "@ecehive/features";
import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZForceUnregisterSchema = z.object({
	shiftScheduleId: z.number().min(1),
	userId: z.number().min(1),
});

export type TForceUnregisterSchema = z.infer<typeof ZForceUnregisterSchema>;

export type TForceUnregisterOptions = {
	ctx: TPermissionProtectedProcedureContext;
	input: TForceUnregisterSchema;
};

export async function forceUnregisterHandler(options: TForceUnregisterOptions) {
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
		});

		if (!targetUser) {
			throw new TRPCError({
				code: "NOT_FOUND",
				message: "Target user not found",
			});
		}

		if (!schedule.users.some((user) => user.id === userId)) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "User is not registered for this shift",
			});
		}

		await unassignUserFromScheduleOccurrences(tx, shiftScheduleId, userId);

		await tx.shiftSchedule.update({
			where: { id: shiftScheduleId },
			data: {
				users: {
					disconnect: { id: userId },
				},
			},
		});
	});

	shiftScheduleEvents.emitUpdate({
		type: "unregister",
		shiftScheduleId,
		userId,
		periodId: emittedPeriodId,
		timestamp: new Date(),
	});

	return { success: true };
}
