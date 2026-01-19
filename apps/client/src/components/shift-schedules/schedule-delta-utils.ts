import type {
	RequirementProgress,
	ShiftSchedule,
} from "./shift-scheduler-utils";

/**
 * User info from delta events
 */
export interface DeltaUser {
	id: number;
	name: string;
}

/**
 * Delta information from shift schedule update events
 */
export interface ScheduleDelta {
	user: DeltaUser;
	availableSlots: number;
	totalSlots: number;
	users: DeltaUser[];
}

/**
 * Shift schedule update event from server subscription
 */
export interface ShiftScheduleUpdateEvent {
	type: "register" | "unregister";
	shiftScheduleId: number;
	userId: number;
	periodId: number;
	timestamp: Date;
	delta: ScheduleDelta;
}

/**
 * Full schedules data structure from listForRegistration query
 */
export interface SchedulesData {
	period: {
		id: number;
		scheduleSignupStart: string;
		scheduleSignupEnd: string;
		min: number | null;
		max: number | null;
		minMaxUnit: "count" | "hours" | "minutes" | null;
	};
	schedules: ShiftSchedule[];
	isWithinSignupWindow: boolean;
	isWithinModifyWindow: boolean;
	isWithinVisibilityWindow: boolean;
	requirementProgress: RequirementProgress | null;
}

/**
 * Get shift duration in minutes for requirement progress calculation
 */
function getShiftDurationMinutes(startTime: string, endTime: string): number {
	const [startHours, startMinutes] = startTime.split(":").map(Number);
	const [endHours, endMinutes] = endTime.split(":").map(Number);

	const startTotalMinutes = startHours * 60 + startMinutes;
	let endTotalMinutes = endHours * 60 + endMinutes;

	// Handle overnight shifts
	if (endTotalMinutes < startTotalMinutes) {
		endTotalMinutes += 24 * 60;
	}

	return endTotalMinutes - startTotalMinutes;
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
	const parseTime = (time: string) => {
		const [hours, minutes] = time.split(":").map(Number);
		return hours * 60 + minutes;
	};

	const s1 = parseTime(start1);
	const e1 = parseTime(end1);
	const s2 = parseTime(start2);
	const e2 = parseTime(end2);

	return s1 < e2 && s2 < e1;
}

/**
 * Check if two schedules overlap in time on the same day
 */
function schedulesOverlap(
	schedule1: { dayOfWeek: number; startTime: string; endTime: string },
	schedule2: { dayOfWeek: number; startTime: string; endTime: string },
): boolean {
	// Different days don't overlap
	if (schedule1.dayOfWeek !== schedule2.dayOfWeek) {
		return false;
	}

	return doTimesOverlap(
		schedule1.startTime,
		schedule1.endTime,
		schedule2.startTime,
		schedule2.endTime,
	);
}

/**
 * Evaluate balancing requirements for a schedule given the list of all schedules.
 * Returns true if the schedule meets balancing requirements.
 *
 * This mirrors the server-side meetsBalancingRequirement function from validation.ts
 *
 * IMPORTANT: The server checks against ALL schedules (not just same shift type).
 * This matches the server behavior exactly.
 */
function calculateMeetsBalancingRequirement(
	schedule: ShiftSchedule,
	allSchedules: ShiftSchedule[],
): boolean {
	// If no balancing is configured, always passes
	if (
		!schedule.isBalancedAcrossPeriod &&
		!schedule.isBalancedAcrossDay &&
		!schedule.isBalancedAcrossOverlap
	) {
		return true;
	}

	const currentFilledSlots = schedule.users.length;

	// Check isBalancedAcrossPeriod: ALL other schedules must have >= current filled slots
	// Note: Server checks against all schedules, not just same shift type
	// Skip schedules that are already full - they shouldn't block others from registering
	if (schedule.isBalancedAcrossPeriod) {
		for (const other of allSchedules) {
			if (other.id === schedule.id) continue;
			if (other.slots > 0 && other.users.length >= other.slots) continue;
			if (other.users.length < currentFilledSlots) return false;
		}
	}

	// Check isBalancedAcrossDay: all schedules on the same day must have >= current filled slots
	// Skip schedules that are already full - they shouldn't block others from registering
	if (schedule.isBalancedAcrossDay) {
		const sameDaySchedules = allSchedules.filter(
			(s) => s.dayOfWeek === schedule.dayOfWeek && s.id !== schedule.id,
		);
		for (const other of sameDaySchedules) {
			if (other.slots > 0 && other.users.length >= other.slots) continue;
			if (other.users.length < currentFilledSlots) return false;
		}
	}

	// Check isBalancedAcrossOverlap: all overlapping schedules must have >= current filled slots
	// Skip schedules that are already full - they shouldn't block others from registering
	if (schedule.isBalancedAcrossOverlap) {
		const overlappingSchedules = allSchedules.filter((s) => {
			if (s.id === schedule.id) return false;
			if (s.dayOfWeek !== schedule.dayOfWeek) return false;
			return doTimesOverlap(
				s.startTime,
				s.endTime,
				schedule.startTime,
				schedule.endTime,
			);
		});

		for (const other of overlappingSchedules) {
			if (other.slots > 0 && other.users.length >= other.slots) continue;
			if (other.users.length < currentFilledSlots) return false;
		}
	}

	return true;
}

/**
 * Recalculate requirement progress based on current user's registered schedules
 */
function recalculateRequirementProgress(
	schedules: ShiftSchedule[],
	period: SchedulesData["period"],
): RequirementProgress | null {
	const { min, max, minMaxUnit } = period;

	// No requirement tracking if no unit defined
	if (!minMaxUnit || (min === null && max === null)) {
		return null;
	}

	// Get user's registered schedules
	const registeredSchedules = schedules.filter((s) => s.isRegistered);

	// Calculate current value based on unit
	let currentComparable: number;
	if (minMaxUnit === "count") {
		currentComparable = registeredSchedules.length;
	} else {
		// For hours/minutes, sum up durations
		currentComparable = registeredSchedules.reduce((total, schedule) => {
			return (
				total + getShiftDurationMinutes(schedule.startTime, schedule.endTime)
			);
		}, 0);
	}

	// Convert thresholds to comparable units (everything in minutes)
	const minComparable =
		min !== null ? (minMaxUnit === "hours" ? min * 60 : min) : undefined;
	const maxComparable =
		max !== null ? (minMaxUnit === "hours" ? max * 60 : max) : undefined;

	const hasReachedMax =
		maxComparable !== undefined && currentComparable >= maxComparable;

	// Convert current value back to display unit
	let currentDisplay: number;
	if (minMaxUnit === "hours") {
		currentDisplay = currentComparable / 60;
	} else {
		currentDisplay = currentComparable;
	}

	return {
		unit: minMaxUnit,
		min: min ?? null,
		max: max ?? null,
		current: currentDisplay,
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

/**
 * Recalculate computed fields for a single schedule after an update.
 * This ensures canRegister, canUnregister, hasTimeOverlap, meetsBalancingRequirement, etc. are correct.
 *
 * Note: meetsRoleRequirement is preserved from the original server response because
 * user's role IDs aren't available client-side. This is acceptable because role
 * requirements don't change based on other users' registrations.
 */
function recalculateScheduleComputedFields(
	schedule: ShiftSchedule,
	allSchedules: ShiftSchedule[],
	currentUserId: number,
	isWithinSignupWindow: boolean,
	hasReachedMax: boolean,
): ShiftSchedule {
	const isRegistered = schedule.users.some((u) => u.id === currentUserId);
	const availableSlots = schedule.slots - schedule.users.length;

	// Check for time overlap with user's other registered schedules (excluding this one)
	const userOtherSchedules = allSchedules.filter(
		(s) => s.id !== schedule.id && s.users.some((u) => u.id === currentUserId),
	);
	const hasOverlap = !isRegistered
		? userOtherSchedules.some((other) => schedulesOverlap(schedule, other))
		: false;

	// User blocked by max requirement (only if not already registered)
	const blockedByMaxRequirement = !isRegistered && hasReachedMax;

	// Preserve meetsRoleRequirement from original (requires user role data not in delta)
	const { meetsRoleRequirement } = schedule;

	// Recalculate balancing requirement based on current state of all schedules
	const meetsBalancingRequirement = calculateMeetsBalancingRequirement(
		schedule,
		allSchedules,
	);

	// User can register if:
	// 1. Not already registered
	// 2. Shift type allows self-assignment
	// 3. Meets role requirements (preserved from original)
	// 4. Meets balancing requirements (recalculated)
	// 5. There are available slots
	// 6. Does not overlap with existing registrations
	// 7. Within signup window
	// 8. Not blocked by max requirement
	const canRegister =
		!isRegistered &&
		schedule.canSelfAssign &&
		meetsRoleRequirement &&
		meetsBalancingRequirement &&
		availableSlots > 0 &&
		!hasOverlap &&
		isWithinSignupWindow &&
		!blockedByMaxRequirement;

	// User can unregister if:
	// 1. Already registered
	// 2. Shift type allows self-assignment
	// 3. Within signup window
	const canUnregister =
		isRegistered && schedule.canSelfAssign && isWithinSignupWindow;

	return {
		...schedule,
		availableSlots,
		isRegistered,
		canRegister,
		canUnregister,
		meetsBalancingRequirement,
		hasTimeOverlap: hasOverlap,
		blockedByMaxRequirement,
	};
}

/**
 * Apply a delta update to the schedules data immutably.
 * Returns new data if the update affects this data, or the original data if not.
 */
export function applyScheduleDelta(
	currentData: SchedulesData,
	event: ShiftScheduleUpdateEvent,
	currentUserId: number,
): SchedulesData {
	// Find the schedule that was updated
	const scheduleIndex = currentData.schedules.findIndex(
		(s) => s.id === event.shiftScheduleId,
	);

	// If schedule not found in current data, return unchanged
	// This could happen if we're viewing filtered data
	if (scheduleIndex === -1) {
		return currentData;
	}

	const schedule = currentData.schedules[scheduleIndex];

	// Create updated schedule with new users list from delta
	// IMPORTANT: Update isRegistered immediately so requirement progress calculation is correct
	const updatedSchedule: ShiftSchedule = {
		...schedule,
		users: event.delta.users,
		availableSlots: event.delta.availableSlots,
		isRegistered: event.delta.users.some((u) => u.id === currentUserId),
	};

	// Create new schedules array with the updated schedule
	const newSchedules = [...currentData.schedules];
	newSchedules[scheduleIndex] = updatedSchedule;

	// Recalculate requirement progress first (needed for hasReachedMax)
	// This now uses the correct isRegistered value from updatedSchedule
	const newRequirementProgress = recalculateRequirementProgress(
		newSchedules,
		currentData.period,
	);

	const hasReachedMax = newRequirementProgress?.hasReachedMax ?? false;

	// Recalculate computed fields for all schedules
	// This is necessary because:
	// 1. The updated schedule's canRegister/canUnregister may change
	// 2. Other schedules' hasTimeOverlap may change (if user registered/unregistered)
	// 3. Other schedules' canRegister may change due to max requirement
	// 4. Other schedules' canRegister may change due to max requirement or balancing requirements
	const recalculatedSchedules = newSchedules.map((s) =>
		recalculateScheduleComputedFields(
			s,
			newSchedules,
			currentUserId,
			currentData.isWithinSignupWindow,
			hasReachedMax,
		),
	);

	return {
		...currentData,
		schedules: recalculatedSchedules,
		requirementProgress: newRequirementProgress,
	};
}

/**
 * Apply an optimistic update for a registration action.
 * Used when the current user performs a mutation before server response.
 */
export function applyOptimisticRegister(
	currentData: SchedulesData,
	shiftScheduleId: number,
	currentUser: DeltaUser,
): SchedulesData {
	const scheduleIndex = currentData.schedules.findIndex(
		(s) => s.id === shiftScheduleId,
	);

	if (scheduleIndex === -1) {
		return currentData;
	}

	const schedule = currentData.schedules[scheduleIndex];

	// Create optimistic delta
	const optimisticEvent: ShiftScheduleUpdateEvent = {
		type: "register",
		shiftScheduleId,
		userId: currentUser.id,
		periodId: currentData.period.id,
		timestamp: new Date(),
		delta: {
			user: currentUser,
			availableSlots: schedule.availableSlots - 1,
			totalSlots: schedule.slots,
			users: [...schedule.users, currentUser],
		},
	};

	return applyScheduleDelta(currentData, optimisticEvent, currentUser.id);
}

/**
 * Apply an optimistic update for an unregistration action.
 * Used when the current user performs a mutation before server response.
 */
export function applyOptimisticUnregister(
	currentData: SchedulesData,
	shiftScheduleId: number,
	currentUser: DeltaUser,
): SchedulesData {
	const scheduleIndex = currentData.schedules.findIndex(
		(s) => s.id === shiftScheduleId,
	);

	if (scheduleIndex === -1) {
		return currentData;
	}

	const schedule = currentData.schedules[scheduleIndex];

	// Create optimistic delta
	const optimisticEvent: ShiftScheduleUpdateEvent = {
		type: "unregister",
		shiftScheduleId,
		userId: currentUser.id,
		periodId: currentData.period.id,
		timestamp: new Date(),
		delta: {
			user: currentUser,
			availableSlots: schedule.availableSlots + 1,
			totalSlots: schedule.slots,
			users: schedule.users.filter((u) => u.id !== currentUser.id),
		},
	};

	return applyScheduleDelta(currentData, optimisticEvent, currentUser.id);
}
