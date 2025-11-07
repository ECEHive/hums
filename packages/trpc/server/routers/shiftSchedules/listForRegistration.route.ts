import {
	getAllSchedulesForBalancing,
	getPeriodById,
	getShiftSchedulesForListing,
	getUserRegisteredSchedules,
	getUserWithRoles,
	hasTimeOverlap,
	meetsBalancingRequirement,
	meetsRoleRequirement,
} from "@ecehive/features";
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
	const period = await getPeriodById(prisma, periodId);

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
	const schedules = await getShiftSchedulesForListing(prisma, where);

	// Get user's roles to check role requirements
	const user = await getUserWithRoles(prisma, userId);

	if (!user) {
		throw new TRPCError({
			code: "UNAUTHORIZED",
			message: "User not found",
		});
	}

	const userRoleIds = new Set(user.roles.map((r) => r.id));

	// Get all shift schedules the user is already registered for
	const userRegisteredSchedules = await getUserRegisteredSchedules(
		prisma,
		userId,
	);

	// Get all schedules for balancing checks (cached for performance)
	const allSchedulesForBalancing = await getAllSchedulesForBalancing(prisma);

	// For each schedule, calculate availability and registration eligibility
	const schedulesWithAvailability = schedules.map((schedule) => {
		const isRegistered = schedule.users.some((u) => u.id === userId);

		// Check if user can self-assign
		const canSelfAssign = schedule.shiftType.canSelfAssign;

		// Check role requirements
		const meetsRole = meetsRoleRequirement(schedule.shiftType, userRoleIds);

		// Check for time overlap with existing registrations
		const hasOverlap = !isRegistered
			? hasTimeOverlap(schedule, userRegisteredSchedules)
			: false;

		// Check balancing restrictions
		const meetsBalancing = meetsBalancingRequirement(
			schedule,
			allSchedulesForBalancing,
		);

		// Calculate available slots (total slots minus registered users)
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
			meetsRole &&
			meetsBalancing &&
			availableSlots > 0 &&
			!hasOverlap;

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
			meetsRoleRequirement: meetsRole,
			meetsBalancingRequirement: meetsBalancing,
			hasTimeOverlap: hasOverlap,
		};
	});

	return {
		period,
		schedules: schedulesWithAvailability,
	};
}
