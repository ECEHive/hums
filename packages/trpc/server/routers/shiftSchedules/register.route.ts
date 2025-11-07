import {
	assignUserToScheduleOccurrences,
	shiftScheduleEvents,
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

/**
 * Parse time string (HH:MM) to minutes since midnight
 */
function parseTimeToMinutes(time: string): number {
	const [hours, minutes] = time.split(":").map(Number);
	return hours * 60 + minutes;
}

/**
 * Check if two time ranges overlap
 */
function doTimesOverlap(
	start1: string,
	end1: string,
	start2: string,
	end2: string,
): boolean {
	const start1Minutes = parseTimeToMinutes(start1);
	const end1Minutes = parseTimeToMinutes(end1);
	const start2Minutes = parseTimeToMinutes(start2);
	const end2Minutes = parseTimeToMinutes(end2);

	return start1Minutes < end2Minutes && end1Minutes > start2Minutes;
}

export async function registerHandler(options: TRegisterOptions) {
	const { shiftScheduleId } = options.input;
	const userId = options.ctx.userId;

	await prisma.$transaction(async (tx) => {
		// Get the shift schedule the user wants to register for
		const targetSchedule = await tx.shiftSchedule.findUnique({
			where: { id: shiftScheduleId },
			include: {
				shiftType: {
					include: {
						roles: true,
					},
				},
				users: { select: { id: true } },
			},
		});

		if (!targetSchedule) {
			throw new TRPCError({
				code: "NOT_FOUND",
				message: "Shift schedule not found",
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
		const user = await tx.user.findUnique({
			where: { id: userId },
			include: {
				roles: true,
			},
		});

		if (!user) {
			throw new TRPCError({
				code: "UNAUTHORIZED",
				message: "User not found",
			});
		}

		const userRoleIds = new Set(user.roles.map((r) => r.id));

		// Check role requirements
		if (targetSchedule.shiftType.doRequireRoles === "all") {
			// User must have ALL required roles
			const requiredRoleIds = targetSchedule.shiftType.roles.map((r) => r.id);
			const hasAllRoles = requiredRoleIds.every((roleId) =>
				userRoleIds.has(roleId),
			);
			if (!hasAllRoles) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You do not have all the required roles for this shift type",
				});
			}
		} else if (targetSchedule.shiftType.doRequireRoles === "any") {
			// User must have AT LEAST ONE required role
			const requiredRoleIds = targetSchedule.shiftType.roles.map((r) => r.id);
			const hasAnyRole =
				requiredRoleIds.length === 0 ||
				requiredRoleIds.some((roleId) => userRoleIds.has(roleId));
			if (!hasAnyRole) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message:
						"You do not have any of the required roles for this shift type",
				});
			}
		}

		// Check balancing restrictions
		if (
			targetSchedule.shiftType.isBalancedAcrossPeriod ||
			targetSchedule.shiftType.isBalancedAcrossDay ||
			targetSchedule.shiftType.isBalancedAcrossOverlap
		) {
			const currentFilledSlots = targetSchedule.users.length;

			// Get all shift schedules for this shift type
			const allTypeSchedules = await tx.shiftSchedule.findMany({
				where: { shiftTypeId: targetSchedule.shiftTypeId },
				include: {
					users: { select: { id: true } },
				},
			});

			// Check isBalancedAcrossPeriod
			if (targetSchedule.shiftType.isBalancedAcrossPeriod) {
				for (const otherSchedule of allTypeSchedules) {
					if (otherSchedule.id === targetSchedule.id) continue;
					const otherFilledSlots = otherSchedule.users.length;
					if (otherFilledSlots < currentFilledSlots) {
						throw new TRPCError({
							code: "BAD_REQUEST",
							message:
								"Cannot register. All shift schedules in the period must be balanced (have equal or more slots filled) before you can register for this one.",
						});
					}
				}
			}

			// Check isBalancedAcrossDay
			if (targetSchedule.shiftType.isBalancedAcrossDay) {
				const sameDaySchedules = allTypeSchedules.filter(
					(s) =>
						s.dayOfWeek === targetSchedule.dayOfWeek &&
						s.id !== targetSchedule.id,
				);
				for (const otherSchedule of sameDaySchedules) {
					const otherFilledSlots = otherSchedule.users.length;
					if (otherFilledSlots < currentFilledSlots) {
						throw new TRPCError({
							code: "BAD_REQUEST",
							message: `Cannot register. All shift schedules on ${getDayName(targetSchedule.dayOfWeek)} must be balanced (have equal or more slots filled) before you can register for this one.`,
						});
					}
				}
			}

			// Check isBalancedAcrossOverlap
			if (targetSchedule.shiftType.isBalancedAcrossOverlap) {
				const overlappingSchedules = allTypeSchedules.filter((s) => {
					if (s.id === targetSchedule.id) return false;
					if (s.dayOfWeek !== targetSchedule.dayOfWeek) return false;
					return doTimesOverlap(
						s.startTime,
						s.endTime,
						targetSchedule.startTime,
						targetSchedule.endTime,
					);
				});

				for (const otherSchedule of overlappingSchedules) {
					const otherFilledSlots = otherSchedule.users.length;
					if (otherFilledSlots < currentFilledSlots) {
						throw new TRPCError({
							code: "BAD_REQUEST",
							message:
								"Cannot register. All overlapping shift schedules must be balanced (have equal or more slots filled) before you can register for this one.",
						});
					}
				}
			}
		}

		// Get all shift schedules the user is already registered for
		const userSchedules = await tx.shiftSchedule.findMany({
			where: {
				users: {
					some: { id: userId },
				},
			},
		});

		// Check for overlaps with existing schedules on the same day
		for (const existingSchedule of userSchedules) {
			if (existingSchedule.dayOfWeek === targetSchedule.dayOfWeek) {
				if (
					doTimesOverlap(
						existingSchedule.startTime,
						existingSchedule.endTime,
						targetSchedule.startTime,
						targetSchedule.endTime,
					)
				) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: `Cannot register for this shift schedule. It overlaps with another shift schedule you are already registered for on ${getDayName(targetSchedule.dayOfWeek)} (${existingSchedule.startTime} - ${existingSchedule.endTime}).`,
					});
				}
			}
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

/**
 * Get the day name from the day of week number
 */
function getDayName(dayOfWeek: number): string {
	const days = [
		"Sunday",
		"Monday",
		"Tuesday",
		"Wednesday",
		"Thursday",
		"Friday",
		"Saturday",
	];
	return days[dayOfWeek] ?? "Unknown";
}
