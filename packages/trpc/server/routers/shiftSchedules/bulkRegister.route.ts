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

export const ZBulkRegisterSchema = z.object({
	shiftScheduleIds: z
		.array(z.number().min(1))
		.min(1, "At least one shift schedule is required")
		.max(50, "Cannot register for more than 50 shifts at once"),
});

export type TBulkRegisterSchema = z.infer<typeof ZBulkRegisterSchema>;

export type TBulkRegisterOptions = {
	ctx: TProtectedProcedureContext;
	input: TBulkRegisterSchema;
};

interface BulkRegisterDelta {
	shiftScheduleId: number;
	periodId: number;
	user: ShiftScheduleUser;
	availableSlots: number;
	totalSlots: number;
	users: ShiftScheduleUser[];
}

export async function bulkRegisterHandler(options: TBulkRegisterOptions) {
	const { shiftScheduleIds } = options.input;
	const userId = options.ctx.user.id;

	// Deduplicate IDs
	const uniqueIds = Array.from(new Set(shiftScheduleIds));

	// Store data needed for event emission after transaction
	const deltas: BulkRegisterDelta[] = [];
	const errors: Array<{ shiftScheduleId: number; message: string }> = [];

	await prisma.$transaction(async (tx) => {
		// Lock all schedules first (in sorted order to prevent deadlocks)
		const sortedIds = [...uniqueIds].sort((a, b) => a - b);
		for (const id of sortedIds) {
			const isLocked = await lockShiftSchedule(tx, id);
			if (!isLocked) {
				errors.push({
					shiftScheduleId: id,
					message: "Shift schedule not found",
				});
			}
		}

		// If any schedules couldn't be locked, throw
		if (errors.length > 0) {
			throw new TRPCError({
				code: "NOT_FOUND",
				message: `Some shift schedules were not found: ${errors.map((e) => e.shiftScheduleId).join(", ")}`,
			});
		}

		// Get user with roles once
		const user = await getUserWithRoles(tx, userId);
		if (!user) {
			throw new TRPCError({
				code: "UNAUTHORIZED",
				message: "User not found",
			});
		}
		const userRoleIds = new Set(user.roles.map((r) => r.id));

		// Load all target schedules
		const targetSchedules = await Promise.all(
			sortedIds.map((id) => getShiftScheduleForRegistration(tx, id)),
		);

		// Validate all schedules exist and narrow types
		const validatedSchedules = targetSchedules.filter(
			(s): s is NonNullable<typeof s> => {
				if (!s) return false;
				return true;
			},
		);

		if (validatedSchedules.length !== sortedIds.length) {
			const missingIds = sortedIds.filter((_id, i) => !targetSchedules[i]);
			throw new TRPCError({
				code: "NOT_FOUND",
				message: `Shift schedule(s) not found: ${missingIds.join(", ")}`,
			});
		}

		// Verify all schedules belong to the same period
		const periodIds = new Set(
			validatedSchedules.map((s) => s.shiftType.periodId),
		);
		if (periodIds.size > 1) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message:
					"All shift schedules must belong to the same period for bulk registration",
			});
		}

		const firstSchedule = validatedSchedules[0];
		if (!firstSchedule) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "No valid shift schedules provided",
			});
		}
		const periodId = firstSchedule.shiftType.periodId;

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

		// Check period access
		assertCanAccessPeriod(period, userRoleIds, {
			isSystemUser: options.ctx.user.isSystemUser,
		});

		// Check if we're within the schedule signup window
		const now = new Date();
		const nowTime = now.getTime();
		const isWithinSignupWindow =
			period.scheduleSignupStart.getTime() <= nowTime &&
			period.scheduleSignupEnd.getTime() >= nowTime;

		if (!isWithinSignupWindow) {
			throw new TRPCError({
				code: "FORBIDDEN",
				message:
					"Shift registration is not currently allowed. Please check the signup window for this period.",
			});
		}

		// Get user's current registered schedules (will grow as we register)
		const userSchedules = await getUserRegisteredSchedules(tx, userId);
		const userSchedulesInPeriod = userSchedules.filter(
			(s) => s.shiftType?.periodId === periodId,
		);
		const schedulesForOverlap = userSchedules.map(
			({ shiftType, ...rest }) => rest,
		);

		// Get all schedules for balancing checks
		const allSchedulesForBalancing = await getAllSchedulesForBalancing(tx);

		// Calculate current requirement progress
		let currentComparable = 0;
		const unit = period.minMaxUnit;
		const maxThreshold =
			period.max !== null && period.max !== undefined && unit
				? convertRequirementThresholdToComparable(period.max, unit)
				: null;

		if (unit) {
			currentComparable = calculateRequirementComparableValue(
				userSchedulesInPeriod,
				unit,
			);
		}

		// Validate and register each schedule sequentially
		// Order matters because each registration affects overlap/balancing/max checks
		for (const schedule of validatedSchedules) {
			// Check if canSelfAssign is allowed
			if (!schedule.shiftType.canSelfAssign) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: `Self-assignment is not allowed for "${schedule.shiftType.name}". An administrator must assign you.`,
				});
			}

			// Check if user already registered
			if (schedule.users.some((u) => u.id === userId)) {
				// Skip silently - user is already registered for this schedule
				continue;
			}

			// Check if there are available slots
			if (schedule.users.length >= schedule.slots) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: `All slots for "${schedule.shiftType.name}" on ${getDayName(schedule.dayOfWeek)} at ${schedule.startTime} are filled`,
				});
			}

			// Validate role requirements
			try {
				validateRoleRequirement(schedule.shiftType, userRoleIds);
			} catch (error) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message:
						error instanceof Error ? error.message : "Role requirement not met",
				});
			}

			// Check balancing restrictions
			if (
				schedule.shiftType.isBalancedAcrossPeriod ||
				schedule.shiftType.isBalancedAcrossDay ||
				schedule.shiftType.isBalancedAcrossOverlap
			) {
				try {
					validateBalancingRequirement(schedule, allSchedulesForBalancing);
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

			// Validate no time overlap with existing registrations
			try {
				validateNoTimeOverlap(schedule, schedulesForOverlap);
			} catch (error) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message:
						error instanceof Error ? error.message : "Time overlap detected",
				});
			}

			// Enforce period maximum requirement if configured
			if (maxThreshold !== null && unit) {
				const addedComparable =
					unit === "count"
						? 1
						: getShiftDurationMinutes(schedule.startTime, schedule.endTime);

				if (currentComparable + addedComparable > maxThreshold) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message:
							"You would exceed the maximum allowed shift registrations for this period.",
					});
				}

				// Update running total for next iteration
				currentComparable += addedComparable;
			}

			// Register the user
			const updatedSchedule = await tx.shiftSchedule.update({
				where: { id: schedule.id },
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

			// Assign user to all occurrences
			await assignUserToScheduleOccurrences(tx, schedule.id, userId);

			// Track this registration for overlap checks in subsequent iterations
			schedulesForOverlap.push({
				id: schedule.id,
				dayOfWeek: schedule.dayOfWeek,
				startTime: schedule.startTime,
				endTime: schedule.endTime,
			});

			// Update balancing data for subsequent iterations
			const balancingIdx = allSchedulesForBalancing.findIndex(
				(s) => s.id === schedule.id,
			);
			if (balancingIdx !== -1) {
				allSchedulesForBalancing[balancingIdx] = {
					...allSchedulesForBalancing[balancingIdx],
					users: updatedSchedule.users,
				};
			}

			// Collect delta for event emission
			deltas.push({
				shiftScheduleId: schedule.id,
				periodId,
				user: { id: user.id, name: user.name },
				availableSlots: updatedSchedule.slots - updatedSchedule.users.length,
				totalSlots: updatedSchedule.slots,
				users: updatedSchedule.users,
			});
		}
	});

	// Emit events for real-time updates (after transaction commits)
	for (const delta of deltas) {
		shiftScheduleEvents.emitUpdate({
			type: "register",
			shiftScheduleId: delta.shiftScheduleId,
			userId,
			periodId: delta.periodId,
			timestamp: new Date(),
			delta: {
				user: delta.user,
				availableSlots: delta.availableSlots,
				totalSlots: delta.totalSlots,
				users: delta.users,
			},
		});
	}

	return {
		success: true,
		registeredCount: deltas.length,
		registeredIds: deltas.map((d) => d.shiftScheduleId),
	};
}

const DAY_NAMES = [
	"Sunday",
	"Monday",
	"Tuesday",
	"Wednesday",
	"Thursday",
	"Friday",
	"Saturday",
];

function getDayName(dayOfWeek: number): string {
	return DAY_NAMES[dayOfWeek] ?? `Day ${dayOfWeek}`;
}
