/**
 * Lightweight types for validation functions to avoid importing full Prisma types
 */
export type ShiftTypeLite = {
	doRequireRoles?: "all" | "any" | string;
	roles?: { id: number }[];
	canSelfAssign?: boolean;
	isBalancedAcrossPeriod?: boolean;
	isBalancedAcrossDay?: boolean;
	isBalancedAcrossOverlap?: boolean;
};

export type ShiftScheduleLite = {
	id: number;
	dayOfWeek: number;
	startTime: string;
	endTime: string;
	slots?: number;
	users?: { id: number }[];
	shiftType?: ShiftTypeLite;
};

/**
 * Check if a schedule is full (no available slots)
 */
function isScheduleFull(schedule: ShiftScheduleLite): boolean {
	const slots = schedule.slots ?? 0;
	const filledSlots = (schedule.users ?? []).length;
	return slots > 0 && filledSlots >= slots;
}

/**
 * Regular expression to validate time format (HH:MM or HH:MM:SS)
 */
export const TIME_REGEX = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/;

/**
 * Parse time string (HH:MM) to minutes since midnight
 */
export function parseTimeToMinutes(time: string): number {
	const [hours, minutes] = time.split(":").map(Number);
	return hours * 60 + minutes;
}

/**
 * Convert time string to seconds since midnight.
 * Supports both HH:MM and HH:MM:SS formats.
 */
export function timeToSeconds(time: string): number {
	const parts = time.split(":").map(Number);
	const hours = parts[0] ?? 0;
	const minutes = parts[1] ?? 0;
	const seconds = parts[2] ?? 0;
	return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Check if two time ranges overlap
 */
export function doTimesOverlap(
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

/**
 * Get the day name from the day of week number
 */
export function getDayName(dayOfWeek: number): string {
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

/**
 * Check whether a user (by role ids) meets the role requirement for a shift type.
 */
export function meetsRoleRequirement(
	shiftType: ShiftTypeLite | undefined,
	userRoleIds: Set<number>,
): boolean {
	if (!shiftType) return true;

	if (shiftType.doRequireRoles === "all") {
		const requiredRoleIds = (shiftType.roles ?? []).map((r) => r.id);
		return requiredRoleIds.every((roleId) => userRoleIds.has(roleId));
	}

	if (shiftType.doRequireRoles === "any") {
		const requiredRoleIds = (shiftType.roles ?? []).map((r) => r.id);
		return (
			requiredRoleIds.length === 0 ||
			requiredRoleIds.some((roleId) => userRoleIds.has(roleId))
		);
	}

	return true;
}

/**
 * Validate role requirements and throw an error if not met
 */
export function validateRoleRequirement(
	shiftType: ShiftTypeLite,
	userRoleIds: Set<number>,
): void {
	if (shiftType.doRequireRoles === "all") {
		const requiredRoleIds = shiftType.roles?.map((r) => r.id) ?? [];
		const hasAllRoles = requiredRoleIds.every((roleId) =>
			userRoleIds.has(roleId),
		);
		if (!hasAllRoles) {
			throw new Error(
				"You do not have all the required roles for this shift type",
			);
		}
	} else if (shiftType.doRequireRoles === "any") {
		const requiredRoleIds = shiftType.roles?.map((r) => r.id) ?? [];
		const hasAnyRole =
			requiredRoleIds.length === 0 ||
			requiredRoleIds.some((roleId) => userRoleIds.has(roleId));
		if (!hasAnyRole) {
			throw new Error(
				"You do not have any of the required roles for this shift type",
			);
		}
	}
}

/**
 * Check if user has time overlap with their existing registered schedules
 */
export function hasTimeOverlap(
	targetSchedule: ShiftScheduleLite,
	userRegisteredSchedules: ShiftScheduleLite[],
): boolean {
	for (const existingSchedule of userRegisteredSchedules) {
		if (existingSchedule.dayOfWeek === targetSchedule.dayOfWeek) {
			if (
				doTimesOverlap(
					existingSchedule.startTime,
					existingSchedule.endTime,
					targetSchedule.startTime,
					targetSchedule.endTime,
				)
			) {
				return true;
			}
		}
	}
	return false;
}

/**
 * Validate time overlap and throw an error if overlap exists
 */
export function validateNoTimeOverlap(
	targetSchedule: ShiftScheduleLite,
	userRegisteredSchedules: ShiftScheduleLite[],
): void {
	for (const existingSchedule of userRegisteredSchedules) {
		if (existingSchedule.dayOfWeek === targetSchedule.dayOfWeek) {
			if (
				doTimesOverlap(
					existingSchedule.startTime,
					existingSchedule.endTime,
					targetSchedule.startTime,
					targetSchedule.endTime,
				)
			) {
				throw new Error(
					`Cannot register for this shift schedule. It overlaps with another shift schedule you are already registered for on ${getDayName(targetSchedule.dayOfWeek)} (${existingSchedule.startTime} - ${existingSchedule.endTime}).`,
				);
			}
		}
	}
}

/**
 * Evaluate balancing requirements for a schedule given the list of all schedules.
 * Returns true if the schedule meets balancing requirements (i.e., it's allowed to accept another user).
 */
export function meetsBalancingRequirement(
	schedule: ShiftScheduleLite,
	allSchedules: ShiftScheduleLite[],
): boolean {
	const st = schedule.shiftType;
	if (!st) return true;

	if (
		!st.isBalancedAcrossPeriod &&
		!st.isBalancedAcrossDay &&
		!st.isBalancedAcrossOverlap
	) {
		return true;
	}

	const currentFilledSlots = (schedule.users ?? []).length;

	// Check isBalancedAcrossPeriod: all schedules must have >= current filled slots
	// Skip schedules that are already full - they shouldn't block others from registering
	if (st.isBalancedAcrossPeriod) {
		for (const other of allSchedules) {
			if (other.id === schedule.id) continue;
			if (isScheduleFull(other)) continue;
			if ((other.users ?? []).length < currentFilledSlots) return false;
		}
	}

	// Check isBalancedAcrossDay: all schedules on the same day must have >= current filled slots
	// Skip schedules that are already full - they shouldn't block others from registering
	if (st.isBalancedAcrossDay) {
		const sameDay = allSchedules.filter(
			(s) => s.dayOfWeek === schedule.dayOfWeek && s.id !== schedule.id,
		);
		for (const other of sameDay) {
			if (isScheduleFull(other)) continue;
			if ((other.users ?? []).length < currentFilledSlots) return false;
		}
	}

	// Check isBalancedAcrossOverlap: all overlapping schedules must have >= current filled slots
	// Skip schedules that are already full - they shouldn't block others from registering
	if (st.isBalancedAcrossOverlap) {
		const overlapping = allSchedules.filter((s) => {
			if (s.id === schedule.id) return false;
			if (s.dayOfWeek !== schedule.dayOfWeek) return false;
			return doTimesOverlap(
				s.startTime,
				s.endTime,
				schedule.startTime,
				schedule.endTime,
			);
		});

		for (const other of overlapping) {
			if (isScheduleFull(other)) continue;
			if ((other.users ?? []).length < currentFilledSlots) return false;
		}
	}

	return true;
}

/**
 * Validate balancing requirements and throw an error if not met
 */
export function validateBalancingRequirement(
	schedule: ShiftScheduleLite,
	allSchedules: ShiftScheduleLite[],
): void {
	const st = schedule.shiftType;
	if (!st) return;

	if (
		!st.isBalancedAcrossPeriod &&
		!st.isBalancedAcrossDay &&
		!st.isBalancedAcrossOverlap
	) {
		return;
	}

	const currentFilledSlots = (schedule.users ?? []).length;

	// Check isBalancedAcrossPeriod
	// Skip schedules that are already full - they shouldn't block others from registering
	if (st.isBalancedAcrossPeriod) {
		for (const other of allSchedules) {
			if (other.id === schedule.id) continue;
			if (isScheduleFull(other)) continue;
			if ((other.users ?? []).length < currentFilledSlots) {
				throw new Error(
					"Cannot register. All shift schedules in the period must be balanced (have equal or more slots filled) before you can register for this one.",
				);
			}
		}
	}

	// Check isBalancedAcrossDay
	// Skip schedules that are already full - they shouldn't block others from registering
	if (st.isBalancedAcrossDay) {
		const sameDay = allSchedules.filter(
			(s) => s.dayOfWeek === schedule.dayOfWeek && s.id !== schedule.id,
		);
		for (const other of sameDay) {
			if (isScheduleFull(other)) continue;
			if ((other.users ?? []).length < currentFilledSlots) {
				throw new Error(
					`Cannot register. All shift schedules on ${getDayName(schedule.dayOfWeek)} must be balanced (have equal or more slots filled) before you can register for this one.`,
				);
			}
		}
	}

	// Check isBalancedAcrossOverlap
	// Skip schedules that are already full - they shouldn't block others from registering
	if (st.isBalancedAcrossOverlap) {
		const overlapping = allSchedules.filter((s) => {
			if (s.id === schedule.id) return false;
			if (s.dayOfWeek !== schedule.dayOfWeek) return false;
			return doTimesOverlap(
				s.startTime,
				s.endTime,
				schedule.startTime,
				schedule.endTime,
			);
		});

		for (const other of overlapping) {
			if (isScheduleFull(other)) continue;
			if ((other.users ?? []).length < currentFilledSlots) {
				throw new Error(
					"Cannot register. All overlapping shift schedules must be balanced (have equal or more slots filled) before you can register for this one.",
				);
			}
		}
	}
}
