import { type Prisma, prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZListForRegistrationSchema = z.object({
	periodId: z.number().min(1),
	dayOfWeek: z.number().min(0).max(6).optional(),
});

export type TListForRegistrationSchema = z.infer<
	typeof ZListForRegistrationSchema
>;

export type TListForRegistrationOptions = {
	ctx: TPermissionProtectedProcedureContext;
	input: TListForRegistrationSchema;
};

/**
 * List shift schedules with availability and registration information for a specific period.
 * Includes slot availability and whether the current user can register.
 */
export async function listForRegistrationHandler(
	options: TListForRegistrationOptions,
) {
	const { periodId, dayOfWeek } = options.input;
	const userId = options.ctx.userId;

	// Get period to check visibility window
	const period = await prisma.period.findUnique({
		where: { id: periodId },
	});

	if (!period) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Period not found",
		});
	}

	// Build where clause
	const where: Prisma.ShiftScheduleWhereInput = {
		shiftType: { periodId },
	};

	if (dayOfWeek !== undefined) {
		where.dayOfWeek = dayOfWeek;
	}

	// Fetch shift schedules with related data
	const schedules = await prisma.shiftSchedule.findMany({
		where,
		include: {
			shiftType: {
				include: {
					roles: true,
				},
			},
			users: {
				select: { id: true, name: true },
			},
		},
		orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
	});

	// Get user's roles to check role requirements
	const user = await prisma.user.findUnique({
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

	// Get all shift schedules the user is already registered for
	const userRegisteredSchedules = await prisma.shiftSchedule.findMany({
		where: {
			users: {
				some: { id: userId },
			},
		},
		select: {
			id: true,
			dayOfWeek: true,
			startTime: true,
			endTime: true,
		},
	});

	// For each schedule, calculate availability and registration eligibility
	const schedulesWithAvailability = await Promise.all(
		schedules.map(async (schedule) => {
			const isRegistered = schedule.users.some((u) => u.id === userId);

			// Check if user can self-assign
			const canSelfAssign = schedule.shiftType.canSelfAssign;

			// Check role requirements
			let meetsRoleRequirement = true;
			if (schedule.shiftType.doRequireRoles === "all") {
				// User must have ALL required roles
				const requiredRoleIds = schedule.shiftType.roles.map((r) => r.id);
				meetsRoleRequirement = requiredRoleIds.every((roleId) =>
					userRoleIds.has(roleId),
				);
			} else if (schedule.shiftType.doRequireRoles === "any") {
				// User must have AT LEAST ONE required role
				const requiredRoleIds = schedule.shiftType.roles.map((r) => r.id);
				meetsRoleRequirement =
					requiredRoleIds.length === 0 ||
					requiredRoleIds.some((roleId) => userRoleIds.has(roleId));
			}

			// Check for time overlap with existing registrations
			let hasTimeOverlap = false;
			if (!isRegistered) {
				for (const existingSchedule of userRegisteredSchedules) {
					if (existingSchedule.dayOfWeek === schedule.dayOfWeek) {
						const existingStart = parseTimeToMinutes(
							existingSchedule.startTime,
						);
						const existingEnd = parseTimeToMinutes(existingSchedule.endTime);
						const scheduleStart = parseTimeToMinutes(schedule.startTime);
						const scheduleEnd = parseTimeToMinutes(schedule.endTime);

						if (scheduleStart < existingEnd && scheduleEnd > existingStart) {
							hasTimeOverlap = true;
							break;
						}
					}
				}
			}

			// Check balancing restrictions
			let meetsBalancingRequirement = true;

			// If balancing is enabled, check if this schedule can accept more users
			// Balancing means all relevant schedules must have >= this schedule's filled slots
			// before this schedule can accept another user
			if (
				schedule.shiftType.isBalancedAcrossPeriod ||
				schedule.shiftType.isBalancedAcrossDay ||
				schedule.shiftType.isBalancedAcrossOverlap
			) {
				// Calculate how many slots are filled in the current schedule
				const currentFilledSlots = schedule.users.length;

				// Get all shift schedules for this shift type
				const allTypeSchedules = await prisma.shiftSchedule.findMany({
					where: { shiftTypeId: schedule.shiftTypeId },
					include: {
						users: { select: { id: true } },
					},
				});

				// Check isBalancedAcrossPeriod: all schedules in the period must have >= current filled slots
				if (schedule.shiftType.isBalancedAcrossPeriod) {
					for (const otherSchedule of allTypeSchedules) {
						if (otherSchedule.id === schedule.id) continue;
						const otherFilledSlots = otherSchedule.users.length;
						if (otherFilledSlots < currentFilledSlots) {
							meetsBalancingRequirement = false;
							break;
						}
					}
				}

				// Check isBalancedAcrossDay: all schedules on the same day must have >= current filled slots
				if (
					meetsBalancingRequirement &&
					schedule.shiftType.isBalancedAcrossDay
				) {
					const sameDaySchedules = allTypeSchedules.filter(
						(s) => s.dayOfWeek === schedule.dayOfWeek && s.id !== schedule.id,
					);
					for (const otherSchedule of sameDaySchedules) {
						const otherFilledSlots = otherSchedule.users.length;
						if (otherFilledSlots < currentFilledSlots) {
							meetsBalancingRequirement = false;
							break;
						}
					}
				}

				// Check isBalancedAcrossOverlap: all overlapping schedules must have >= current filled slots
				if (
					meetsBalancingRequirement &&
					schedule.shiftType.isBalancedAcrossOverlap
				) {
					const overlappingSchedules = allTypeSchedules.filter((s) => {
						if (s.id === schedule.id) return false;
						if (s.dayOfWeek !== schedule.dayOfWeek) return false;
						const sStart = parseTimeToMinutes(s.startTime);
						const sEnd = parseTimeToMinutes(s.endTime);
						const schedStart = parseTimeToMinutes(schedule.startTime);
						const schedEnd = parseTimeToMinutes(schedule.endTime);
						return sStart < schedEnd && sEnd > schedStart;
					});

					for (const otherSchedule of overlappingSchedules) {
						const otherFilledSlots = otherSchedule.users.length;
						if (otherFilledSlots < currentFilledSlots) {
							meetsBalancingRequirement = false;
							break;
						}
					}
				}
			} // Calculate available slots (total slots minus registered users)
			const availableSlots = schedule.slots - schedule.users.length;

			// User can register if:
			// 1. Not already registered
			// 2. Shift type allows self-assignment
			// 3. Meets role requirements
			// 4. Meets balancing requirements
			// 5. There are available slots
			// 6. Does not overlap with existing registrations
			const canRegister =
				!isRegistered &&
				canSelfAssign &&
				meetsRoleRequirement &&
				meetsBalancingRequirement &&
				availableSlots > 0 &&
				!hasTimeOverlap;

			return {
				id: schedule.id,
				shiftTypeId: schedule.shiftTypeId,
				shiftTypeName: schedule.shiftType.name,
				shiftTypeColor: schedule.shiftType.color,
				shiftTypeLocation: schedule.shiftType.location,
				slots: schedule.slots,
				dayOfWeek: schedule.dayOfWeek,
				startTime: schedule.startTime,
				endTime: schedule.endTime,
				users: schedule.users,
				availableSlots,
				isRegistered,
				canRegister,
				canSelfAssign,
				meetsRoleRequirement,
				meetsBalancingRequirement,
				hasTimeOverlap,
			};
		}),
	);

	return {
		period,
		schedules: schedulesWithAvailability,
	};
}

/**
 * Parse time string (HH:MM) to minutes since midnight
 */
function parseTimeToMinutes(time: string): number {
	const [hours, minutes] = time.split(":").map(Number);
	return hours * 60 + minutes;
}
