import {
	assertCanAccessPeriod,
	assignUserToScheduleOccurrences,
	calculateRequirementComparableValue,
	convertRequirementThresholdToComparable,
	getAllSchedulesForBalancing,
	getShiftDurationMinutes,
	getShiftScheduleForRegistration,
	getUserRegisteredSchedules,
	getUserWithRoles,
	lockShiftSchedule,
	type ShiftScheduleUser,
	shiftScheduleEvents,
	validateBalancingRequirement,
	validateNoTimeOverlap,
	validateRoleRequirement,
} from "@ecehive/features";
import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import z from "zod";
import type { TProtectedProcedureContext } from "../../trpc";

export const ZRegisterSchema = z.object({
	shiftScheduleId: z.number().min(1),
});

export type TRegisterSchema = z.infer<typeof ZRegisterSchema>;

export type TRegisterOptions = {
	ctx: TProtectedProcedureContext;
	input: TRegisterSchema;
};

export async function registerHandler(options: TRegisterOptions) {
	const { shiftScheduleId } = options.input;
	const userId = options.ctx.user.id;

	// Store data needed for event emission after transaction
	let emittedPeriodId = 0;
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

		// save period id for use after the transaction (avoid redundant query)
		emittedPeriodId = period.id;

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
		assertCanAccessPeriod(period, userRoleIds, {
			isSystemUser: options.ctx.user.isSystemUser,
		});

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
		const schedulesForOverlap = userSchedules.map(
			({ shiftType, ...rest }) => rest,
		);

		// Validate no time overlap (throws if overlap exists)
		try {
			validateNoTimeOverlap(targetSchedule, schedulesForOverlap);
		} catch (error) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message:
					error instanceof Error ? error.message : "Time overlap detected",
			});
		}

		// Enforce period maximum requirement if configured
		if (period.max !== null && period.max !== undefined && period.minMaxUnit) {
			const unit = period.minMaxUnit;
			const userPeriodSchedules = userSchedules.filter(
				(schedule) => schedule.shiftType?.periodId === period.id,
			);
			const currentComparable = calculateRequirementComparableValue(
				userPeriodSchedules,
				unit,
			);
			const addedComparable =
				unit === "count"
					? 1
					: getShiftDurationMinutes(
							targetSchedule.startTime,
							targetSchedule.endTime,
						);
			const maxComparable = convertRequirementThresholdToComparable(
				period.max,
				unit,
			);

			if (currentComparable + addedComparable > maxComparable) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message:
						"You have reached the maximum allowed shift registrations for this period.",
				});
			}
		}

		// Connect user to shift schedule and get updated data
		const updatedSchedule = await tx.shiftSchedule.update({
			where: { id: shiftScheduleId },
			data: {
				users: {
					connect: { id: userId },
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

		// Assign user to all occurrences
		await assignUserToScheduleOccurrences(tx, shiftScheduleId, userId);
	});

	// Emit event for real-time updates (after transaction commits)
	if (deltaData) {
		shiftScheduleEvents.emitUpdate({
			type: "register",
			shiftScheduleId,
			userId,
			periodId: emittedPeriodId,
			timestamp: new Date(),
			delta: deltaData,
		});
	}

	return { success: true };
}
