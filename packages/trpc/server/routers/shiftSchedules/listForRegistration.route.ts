import {
	calculateRequirementComparableValue,
	convertComparableValueToUnit,
	convertRequirementThresholdToComparable,
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
	const userId = options.ctx.user.id;

	// Get period to check visibility window
	const period = await getPeriodById(prisma, periodId);

	if (!period) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Period not found",
		});
	}

	// Check if period is within visibility window
	const now = new Date();
	const isVisibleByStart =
		!period.visibleStart || new Date(period.visibleStart) <= now;
	const isVisibleByEnd =
		!period.visibleEnd || new Date(period.visibleEnd) >= now;
	const isWithinVisibilityWindow = isVisibleByStart && isVisibleByEnd;

	if (!isWithinVisibilityWindow) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "Period is not currently visible",
		});
	}

	// Check if we're within the schedule signup window
	const isSignupByStart =
		!period.scheduleSignupStart || new Date(period.scheduleSignupStart) <= now;
	const isSignupByEnd =
		!period.scheduleSignupEnd || new Date(period.scheduleSignupEnd) >= now;
	const isWithinSignupWindow = isSignupByStart && isSignupByEnd;

	// Check if we're within the schedule modify window
	const isModifyByStart =
		!period.scheduleModifyStart || new Date(period.scheduleModifyStart) <= now;
	const isModifyByEnd =
		!period.scheduleModifyEnd || new Date(period.scheduleModifyEnd) >= now;
	const isWithinModifyWindow = isModifyByStart && isModifyByEnd;

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
	const userSchedulesInPeriod = userRegisteredSchedules.filter(
		(schedule) => schedule.shiftType?.periodId === period.id,
	);
	const schedulesForOverlap = userRegisteredSchedules.map(
		({ shiftType, ...rest }) => rest,
	);

	// Get all schedules for balancing checks (cached for performance)
	const allSchedulesForBalancing = await getAllSchedulesForBalancing(prisma);

	// For each schedule, calculate availability and registration eligibility
	const requirementUnit =
		period.minMaxUnit && (period.min !== null || period.max !== null)
			? period.minMaxUnit
			: null;

	let requirementProgress: {
		unit: typeof period.minMaxUnit;
		min: number | null;
		max: number | null;
		current: number;
		minPercent: number | null;
		maxPercent: number | null;
		hasReachedMax: boolean;
	} | null = null;

	if (requirementUnit) {
		const currentComparable = calculateRequirementComparableValue(
			userSchedulesInPeriod,
			requirementUnit,
		);
		const minComparable =
			period.min !== null && period.min !== undefined
				? convertRequirementThresholdToComparable(period.min, requirementUnit)
				: undefined;
		const maxComparable =
			period.max !== null && period.max !== undefined
				? convertRequirementThresholdToComparable(period.max, requirementUnit)
				: undefined;
		const hasReachedMax =
			maxComparable !== undefined && currentComparable >= maxComparable;
		requirementProgress = {
			unit: requirementUnit,
			min: period.min ?? null,
			max: period.max ?? null,
			current: convertComparableValueToUnit(currentComparable, requirementUnit),
			minPercent:
				minComparable && minComparable > 0
					? Math.min(100, (currentComparable / minComparable) * 100)
					: null,
			maxPercent:
				maxComparable && maxComparable > 0
					? Math.min(100, (currentComparable / maxComparable) * 100)
					: null,
			hasReachedMax,
		};
	}

	const schedulesWithAvailability = schedules.map((schedule) => {
		const isRegistered = schedule.users.some((u) => u.id === userId);

		// Check if user can self-assign
		const canSelfAssign = schedule.shiftType.canSelfAssign;

		// Check role requirements
		const meetsRole = meetsRoleRequirement(schedule.shiftType, userRoleIds);

		// Check for time overlap with existing registrations
		const hasOverlap = !isRegistered
			? hasTimeOverlap(schedule, schedulesForOverlap)
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
		// 7. Within signup window (for new registrations)
		const blockedByMaxRequirement =
			!isRegistered && (requirementProgress?.hasReachedMax ?? false);

		const canRegister =
			!isRegistered &&
			canSelfAssign &&
			meetsRole &&
			meetsBalancing &&
			availableSlots > 0 &&
			!hasOverlap &&
			isWithinSignupWindow &&
			!blockedByMaxRequirement;

		// User can unregister if:
		// 1. Already registered
		// 2. Shift type allows self-assignment
		// 3. Within signup window (unregister uses same window as register)
		const canUnregister = isRegistered && canSelfAssign && isWithinSignupWindow;

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
			canUnregister,
			canSelfAssign,
			meetsRoleRequirement: meetsRole,
			meetsBalancingRequirement: meetsBalancing,
			hasTimeOverlap: hasOverlap,
			blockedByMaxRequirement,
		};
	});

	return {
		period,
		schedules: schedulesWithAvailability,
		isWithinSignupWindow,
		isWithinModifyWindow,
		isWithinVisibilityWindow,
		requirementProgress,
	};
}
