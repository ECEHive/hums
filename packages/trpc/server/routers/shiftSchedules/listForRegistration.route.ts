import {
	assertCanAccessPeriod,
	calculateRequirementComparableValue,
	convertComparableValueToUnit,
	convertRequirementThresholdToComparable,
	getPeriodById,
	getSchedulesForRegistration,
	getShiftTypesForRegistration,
	getUserWithRoles,
	hasTimeOverlap,
	meetsBalancingRequirementForAll,
	meetsRoleRequirement,
} from "@ecehive/features";
import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import z from "zod";
import type { TProtectedProcedureContext } from "../../trpc";

export const ZListForRegistrationSchema = z.object({
	periodId: z.number().min(1),
	dayOfWeek: z.number().min(0).max(6).optional(),
});

export type TListForRegistrationSchema = z.infer<
	typeof ZListForRegistrationSchema
>;

export type TListForRegistrationOptions = {
	ctx: TProtectedProcedureContext;
	input: TListForRegistrationSchema;
	signal?: AbortSignal;
};

/**
 * During a signup rush people refresh when the page is slow, and the server would
 * otherwise finish every abandoned list before getting to live ones.
 */
function throwIfClientGone(signal: AbortSignal | undefined) {
	if (signal?.aborted) {
		throw new TRPCError({
			code: "CLIENT_CLOSED_REQUEST",
			message: "Client closed the request",
		});
	}
}

/**
 * List shift schedules with availability and registration information for a specific period.
 * Includes slot availability and whether the current user can register.
 */
export async function listForRegistrationHandler(
	options: TListForRegistrationOptions,
) {
	const { periodId, dayOfWeek } = options.input;
	const userId = options.ctx.user.id;
	const { signal } = options;

	throwIfClientGone(signal);

	// Two stages rather than all at once: one list can't take most of the
	// connection pool, and abandoned lists skip the big schedules query.
	const [period, user] = await Promise.all([
		getPeriodById(prisma, periodId),
		getUserWithRoles(prisma, userId),
	]);

	throwIfClientGone(signal);

	if (!period) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Period not found",
		});
	}

	// Check if period is within visibility window
	const now = new Date();
	const nowTime = now.getTime();
	const isVisibleByStart = period.visibleStart.getTime() <= nowTime;
	const isVisibleByEnd = period.visibleEnd.getTime() >= nowTime;
	const isWithinVisibilityWindow = isVisibleByStart && isVisibleByEnd;

	if (!isWithinVisibilityWindow) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "Period is not currently visible",
		});
	}

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

	// Check if we're within the schedule signup window
	const isSignupByStart = period.scheduleSignupStart.getTime() <= nowTime;
	const isSignupByEnd = period.scheduleSignupEnd.getTime() >= nowTime;
	const isWithinSignupWindow = isSignupByStart && isSignupByEnd;

	// Check if we're within the schedule modify window
	const isModifyByStart = period.scheduleModifyStart.getTime() <= nowTime;
	const isModifyByEnd = period.scheduleModifyEnd.getTime() >= nowTime;
	const isWithinModifyWindow = isModifyByStart && isModifyByEnd;

	const [shiftTypes, periodSchedules] = await Promise.all([
		getShiftTypesForRegistration(prisma, periodId),
		// Always the whole period: balancing compares across days
		getSchedulesForRegistration(prisma, periodId),
	]);

	throwIfClientGone(signal);

	const shiftTypesById = new Map(shiftTypes.map((type) => [type.id, type]));
	// The two reads aren't one snapshot, so a shift type added between them is
	// left out until the next refresh instead of failing the whole list
	const allSchedules = periodSchedules.filter((schedule) =>
		shiftTypesById.has(schedule.shiftTypeId),
	);

	// The period's schedules already carry their users, so no separate query
	const userSchedulesInPeriod = allSchedules.filter((schedule) =>
		schedule.users.some((u) => u.id === userId),
	);

	const meetsRoleByShiftType = new Map(
		shiftTypes.map((type) => [
			type.id,
			meetsRoleRequirement(type, userRoleIds),
		]),
	);
	const meetsBalancingById = meetsBalancingRequirementForAll(
		allSchedules,
		shiftTypesById,
	);
	const schedules =
		dayOfWeek === undefined
			? allSchedules
			: allSchedules.filter((schedule) => schedule.dayOfWeek === dayOfWeek);

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
		// Every schedule's shift type is in its period, which is what both queries filter on
		const shiftType = shiftTypesById.get(schedule.shiftTypeId);
		if (!shiftType) {
			throw new TRPCError({
				code: "INTERNAL_SERVER_ERROR",
				message: `Shift type ${schedule.shiftTypeId} not found`,
			});
		}

		const isRegistered = schedule.users.some((u) => u.id === userId);

		// Check if user can self-assign
		const canSelfAssign = shiftType.canSelfAssign;

		// Check role requirements
		const meetsRole = meetsRoleByShiftType.get(schedule.shiftTypeId) ?? false;

		// Check for time overlap with existing registrations
		const hasOverlap = !isRegistered
			? hasTimeOverlap(schedule, userSchedulesInPeriod)
			: false;

		// Check balancing restrictions
		const meetsBalancing = meetsBalancingById.get(schedule.id) ?? true;

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
			shiftTypeName: shiftType.name,
			shiftTypeColor: shiftType.color,
			shiftTypeLocation: shiftType.location,
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
			// Balancing config for client-side recalculation
			isBalancedAcrossPeriod: shiftType.isBalancedAcrossPeriod,
			isBalancedAcrossDay: shiftType.isBalancedAcrossDay,
			isBalancedAcrossOverlap: shiftType.isBalancedAcrossOverlap,
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
