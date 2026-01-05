import {
	assertCanAccessPeriod,
	getShiftScheduleForRegistration,
	getUserWithRoles,
	lockShiftSchedule,
	type ShiftScheduleUser,
	shiftScheduleEvents,
	unassignUserFromScheduleOccurrences,
} from "@ecehive/features";
import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import z from "zod";
import type { TProtectedProcedureContext } from "../../trpc";

export const ZUnregisterSchema = z.object({
	shiftScheduleId: z.number().min(1),
});

export type TUnregisterSchema = z.infer<typeof ZUnregisterSchema>;

export type TUnregisterOptions = {
	ctx: TProtectedProcedureContext;
	input: TUnregisterSchema;
};

export async function unregisterHandler(options: TUnregisterOptions) {
	const { shiftScheduleId } = options.input;
	const userId = options.ctx.user.id;
	const user = await getUserWithRoles(prisma, userId);

	if (!user) {
		throw new TRPCError({
			code: "UNAUTHORIZED",
			message: "User not found",
		});
	}

	const userRoleIds = new Set(user.roles.map((r) => r.id));

	// Store data needed for event emission after transaction
	let periodId = 0;
	let deltaData: {
		user: ShiftScheduleUser;
		availableSlots: number;
		totalSlots: number;
		users: ShiftScheduleUser[];
	} | null = null;

	await prisma.$transaction(async (tx) => {
		const isLocked = await lockShiftSchedule(tx, shiftScheduleId);

		if (!isLocked) {
			throw new TRPCError({
				code: "NOT_FOUND",
				message: "Shift schedule not found",
			});
		}

		// Get the shift schedule to verify it exists and check canSelfAssign
		const targetSchedule = await getShiftScheduleForRegistration(
			tx,
			shiftScheduleId,
		);

		if (!targetSchedule) {
			throw new TRPCError({
				code: "NOT_FOUND",
				message: "Shift schedule not found",
			});
		}

		// Store periodId for event emission
		periodId = targetSchedule.shiftType.periodId;

		// Get the period to check time windows
		const period = await tx.period.findUnique({
			where: { id: periodId },
			include: {
				roles: {
					select: { id: true },
				},
			},
		});

		if (!period) {
			throw new TRPCError({
				code: "NOT_FOUND",
				message: "Period not found",
			});
		}

		assertCanAccessPeriod(period, userRoleIds, {
			isSystemUser: options.ctx.user.isSystemUser,
		});

		// Check if we're within the schedule signup window
		const now = new Date();
		const nowTime = now.getTime();
		const isSignupByStart = period.scheduleSignupStart.getTime() <= nowTime;
		const isSignupByEnd = period.scheduleSignupEnd.getTime() >= nowTime;
		const isWithinSignupWindow = isSignupByStart && isSignupByEnd;

		if (!isWithinSignupWindow) {
			throw new TRPCError({
				code: "FORBIDDEN",
				message:
					"Shift unregistration is not currently allowed. Please check the signup window for this period.",
			});
		}

		// Check if canSelfAssign is allowed
		if (!targetSchedule.shiftType.canSelfAssign) {
			throw new TRPCError({
				code: "FORBIDDEN",
				message:
					"Self-unregistration is not allowed for this shift type. An administrator must unassign you.",
			});
		}

		// Check if user is actually registered
		if (!targetSchedule.users.some((u) => u.id === userId)) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "You are not registered for this shift schedule",
			});
		}

		// Unassign user from all occurrences
		await unassignUserFromScheduleOccurrences(tx, shiftScheduleId, userId);

		// Disconnect user from shift schedule and get updated data
		const updatedSchedule = await tx.shiftSchedule.update({
			where: { id: shiftScheduleId },
			data: {
				users: {
					disconnect: { id: userId },
				},
			},
			select: {
				slots: true,
				users: {
					select: { id: true, name: true },
				},
			},
		});

		// Prepare delta data for event emission
		deltaData = {
			user: { id: user.id, name: user.name },
			availableSlots: updatedSchedule.slots - updatedSchedule.users.length,
			totalSlots: updatedSchedule.slots,
			users: updatedSchedule.users,
		};
	});

	// Emit event for real-time updates (after transaction commits)
	if (deltaData) {
		shiftScheduleEvents.emitUpdate({
			type: "unregister",
			shiftScheduleId,
			userId,
			periodId,
			timestamp: new Date(),
			delta: deltaData,
		});
	}

	return { success: true };
}
