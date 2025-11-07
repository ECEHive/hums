import {
	assignUserToScheduleOccurrences,
	getAllSchedulesForBalancing,
	getShiftScheduleForRegistration,
	getUserRegisteredSchedules,
	getUserWithRoles,
	shiftScheduleEvents,
	validateBalancingRequirement,
	validateNoTimeOverlap,
	validateRoleRequirement,
} from "@ecehive/features";
import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZRegisterSchema = z.object({
	shiftScheduleId: z.number().min(1),
});

export type TRegisterSchema = z.infer<typeof ZRegisterSchema>;

export type TRegisterOptions = {
	ctx: TPermissionProtectedProcedureContext;
	input: TRegisterSchema;
};

export async function registerHandler(options: TRegisterOptions) {
	const { shiftScheduleId } = options.input;
	const userId = options.ctx.userId;

	await prisma.$transaction(async (tx) => {
		// Get the shift schedule the user wants to register for
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

		// Get the period to check time windows
		const period = await tx.period.findUnique({
			where: { id: targetSchedule.shiftType.periodId },
		});

		if (!period) {
			throw new TRPCError({
				code: "NOT_FOUND",
				message: "Period not found",
			});
		}

		// Check if we're within the schedule signup window
		const now = new Date();
		const isSignupByStart =
			!period.scheduleSignupStart ||
			new Date(period.scheduleSignupStart) <= now;
		const isSignupByEnd =
			!period.scheduleSignupEnd || new Date(period.scheduleSignupEnd) >= now;
		const isWithinSignupWindow = isSignupByStart && isSignupByEnd;

		if (!isWithinSignupWindow) {
			throw new TRPCError({
				code: "FORBIDDEN",
				message:
					"Shift registration is not currently allowed. Please check the signup window for this period.",
			});
		}

		// Check if canSelfAssign is allowed
		if (!targetSchedule.shiftType.canSelfAssign) {
			throw new TRPCError({
				code: "FORBIDDEN",
				message:
					"Self-assignment is not allowed for this shift type. An administrator must assign you.",
			});
		}

		// Check if user already registered
		if (targetSchedule.users.some((u) => u.id === userId)) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "You are already registered for this shift schedule",
			});
		}

		// Check if there are available slots
		if (targetSchedule.users.length >= targetSchedule.slots) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "All slots for this shift schedule are filled",
			});
		}

		// Get user's roles to check role requirements
		const user = await getUserWithRoles(tx, userId);

		if (!user) {
			throw new TRPCError({
				code: "UNAUTHORIZED",
				message: "User not found",
			});
		}

		const userRoleIds = new Set(user.roles.map((r) => r.id));

		// Validate role requirements (throws if not met)
		try {
			validateRoleRequirement(targetSchedule.shiftType, userRoleIds);
		} catch (error) {
			throw new TRPCError({
				code: "FORBIDDEN",
				message:
					error instanceof Error ? error.message : "Role requirement not met",
			});
		}

		// Check balancing restrictions
		if (
			targetSchedule.shiftType.isBalancedAcrossPeriod ||
			targetSchedule.shiftType.isBalancedAcrossDay ||
			targetSchedule.shiftType.isBalancedAcrossOverlap
		) {
			// Get all shift schedules for balancing validation
			const allSchedules = await getAllSchedulesForBalancing(tx);

			// Validate balancing requirements (throws if not met)
			try {
				validateBalancingRequirement(targetSchedule, allSchedules);
			} catch (error) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message:
						error instanceof Error
							? error.message
							: "Balancing requirement not met",
				});
			}
		}

		// Get all shift schedules the user is already registered for
		const userSchedules = await getUserRegisteredSchedules(tx, userId);

		// Validate no time overlap (throws if overlap exists)
		try {
			validateNoTimeOverlap(targetSchedule, userSchedules);
		} catch (error) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message:
					error instanceof Error ? error.message : "Time overlap detected",
			});
		}

		// Connect user to shift schedule
		await tx.shiftSchedule.update({
			where: { id: shiftScheduleId },
			data: {
				users: {
					connect: { id: userId },
				},
			},
		});

		// Assign user to all occurrences
		await assignUserToScheduleOccurrences(tx, shiftScheduleId, userId);
	});

	// Emit event for real-time updates (after transaction commits)
	shiftScheduleEvents.emitUpdate({
		type: "register",
		shiftScheduleId,
		userId,
		periodId: await prisma.shiftSchedule
			.findUnique({
				where: { id: shiftScheduleId },
				select: { shiftType: { select: { periodId: true } } },
			})
			.then((s) => s?.shiftType.periodId ?? 0),
		timestamp: new Date(),
	});

	return { success: true };
}
