import type { Prisma } from "@ecehive/prisma";

/**
 * Represents an availability window for a user on a given day of week.
 */
export type AvailabilityWindow = {
	userId: number;
	dayOfWeek: number;
	startMinutes: number;
	endMinutes: number;
};

/**
 * Represents a time slot that is available for booking.
 */
export type AvailableSlot = {
	start: Date;
	end: Date;
};

/**
 * Parse a time string "HH:MM" or "HH:MM:SS" into minutes since midnight.
 */
export function timeToMinutes(time: string): number {
	const parts = time.split(":");
	const hours = Number.parseInt(parts[0], 10);
	const minutes = Number.parseInt(parts[1], 10);
	return hours * 60 + minutes;
}

/**
 * Compute all valid booking time slots for an instant event type.
 *
 * This function:
 * 1. Fetches the event type with its scheduler roles
 * 2. Finds all eligible schedulers (users with matching roles + availability)
 * 3. Finds existing bookings that could conflict
 * 4. Computes all valid slots within the booking window
 *
 * @param tx - Prisma client/transaction
 * @param instantEventTypeId - The event type to compute slots for
 * @param dateRangeStart - Start of the date range to search
 * @param dateRangeEnd - End of the date range to search
 * @param slotIntervalMinutes - Interval between slot start times (default: 15)
 */
export async function computeAvailableSlots(
	tx: Prisma.TransactionClient,
	instantEventTypeId: number,
	dateRangeStart: Date,
	dateRangeEnd: Date,
	slotIntervalMinutes = 15,
	requestorId?: number,
): Promise<AvailableSlot[]> {
	// 1. Fetch event type with configuration
	const eventType = await tx.instantEventType.findUnique({
		where: { id: instantEventTypeId },
		include: {
			schedulerRoles: { select: { id: true } },
			requiredRoles: { select: { id: true, name: true } },
		},
	});

	if (!eventType || !eventType.isActive) {
		return [];
	}

	// Apply booking window constraints
	const windowStart =
		eventType.bookingWindowStart &&
		eventType.bookingWindowStart > dateRangeStart
			? eventType.bookingWindowStart
			: dateRangeStart;
	const windowEnd =
		eventType.bookingWindowEnd && eventType.bookingWindowEnd < dateRangeEnd
			? eventType.bookingWindowEnd
			: dateRangeEnd;

	if (windowStart >= windowEnd) {
		return [];
	}

	const schedulerRoleIds = eventType.schedulerRoles.map((r) => r.id);

	// 2. Find eligible schedulers: users matching scheduler roles with availability defined
	//    The requestor is excluded — they are a participant, not a scheduler.
	const eligibleSchedulers = await tx.user.findMany({
		where: {
			...(requestorId ? { NOT: { id: requestorId } } : {}),
			...(schedulerRoleIds.length > 0
				? {
						roles: {
							some: {
								id: { in: schedulerRoleIds },
							},
						},
					}
				: {}),
			availabilities: {
				some: {},
			},
		},
		select: {
			id: true,
			roles: { select: { id: true } },
			availabilities: {
				select: {
					dayOfWeek: true,
					startTime: true,
					endTime: true,
				},
			},
		},
	});

	if (eligibleSchedulers.length === 0) {
		return [];
	}

	// Build per-user availability map: userId -> Map<dayOfWeek, AvailabilityWindow[]>
	const userAvailabilityMap = new Map<
		number,
		Map<number, { startMinutes: number; endMinutes: number }[]>
	>();

	for (const scheduler of eligibleSchedulers) {
		const dayMap = new Map<
			number,
			{ startMinutes: number; endMinutes: number }[]
		>();
		for (const avail of scheduler.availabilities) {
			const windows = dayMap.get(avail.dayOfWeek) ?? [];
			windows.push({
				startMinutes: timeToMinutes(avail.startTime),
				endMinutes: timeToMinutes(avail.endTime),
			});
			dayMap.set(avail.dayOfWeek, windows);
		}
		userAvailabilityMap.set(scheduler.id, dayMap);
	}

	// 3. Fetch existing bookings in the window to check conflicts
	const existingBookings = await tx.instantEventBooking.findMany({
		where: {
			startTime: { lt: windowEnd },
			endTime: { gt: windowStart },
		},
		select: {
			startTime: true,
			endTime: true,
			schedulers: { select: { id: true } },
		},
	});

	// Build a set of "userId:start:end" for quick conflict checking
	const schedulerBookingIntervals: {
		userId: number;
		start: number;
		end: number;
	}[] = [];
	for (const booking of existingBookings) {
		for (const scheduler of booking.schedulers) {
			schedulerBookingIntervals.push({
				userId: scheduler.id,
				start: booking.startTime.getTime(),
				end: booking.endTime.getTime(),
			});
		}
	}

	// 4. Build required role map for composite requirements
	const requiredRoleIds = eventType.requiredRoles.map((r) => r.id);

	// Helper: check if a user has a specific role
	const userRoleMap = new Map<number, Set<number>>();
	for (const scheduler of eligibleSchedulers) {
		userRoleMap.set(scheduler.id, new Set(scheduler.roles.map((r) => r.id)));
	}

	const durationMs = eventType.durationMinutes * 60 * 1000;
	const intervalMs = slotIntervalMinutes * 60 * 1000;

	// 5. Iterate through every possible slot in the window
	//    Align cursor to the next even interval boundary so slots always
	//    fall on clean 15-minute (or other interval) marks.
	const slots: AvailableSlot[] = [];
	const rawCursor = windowStart.getTime();
	const remainder = rawCursor % intervalMs;
	let cursor =
		remainder === 0 ? rawCursor : rawCursor + (intervalMs - remainder);
	const endBound = windowEnd.getTime();

	while (cursor + durationMs <= endBound) {
		const slotStart = cursor;
		const slotEnd = cursor + durationMs;
		const slotStartDate = new Date(slotStart);
		const dayOfWeek = slotStartDate.getDay(); // 0 = Sunday
		const minuteOfDay =
			slotStartDate.getHours() * 60 + slotStartDate.getMinutes();
		const slotEndMinuteOfDay = minuteOfDay + eventType.durationMinutes;

		// Find schedulers available for this slot
		const availableForSlot: number[] = [];

		for (const scheduler of eligibleSchedulers) {
			const dayMap = userAvailabilityMap.get(scheduler.id);
			if (!dayMap) continue;

			const windows = dayMap.get(dayOfWeek);
			if (!windows) continue;

			// Check if any availability window covers the full slot duration
			const coversSlot = windows.some(
				(w) =>
					w.startMinutes <= minuteOfDay && w.endMinutes >= slotEndMinuteOfDay,
			);
			if (!coversSlot) continue;

			// Check if this scheduler has a conflicting booking
			const hasConflict = schedulerBookingIntervals.some(
				(b) =>
					b.userId === scheduler.id && b.start < slotEnd && b.end > slotStart,
			);
			if (hasConflict) continue;

			availableForSlot.push(scheduler.id);
		}

		// Check if we can assign enough schedulers satisfying required roles + minSchedulers
		if (availableForSlot.length >= eventType.minSchedulers) {
			const canAssign = canSatisfyAssignment(
				availableForSlot,
				requiredRoleIds,
				eventType.minSchedulers,
				userRoleMap,
			);
			if (canAssign) {
				slots.push({
					start: new Date(slotStart),
					end: new Date(slotEnd),
				});
			}
		}

		cursor += intervalMs;
	}

	return slots;
}

/**
 * Simulates the greedy scheduler assignment algorithm to verify that
 * the available schedulers can satisfy both required role coverage and
 * the minimum scheduler count. This mirrors the actual assignment logic
 * in booking.ts to avoid showing slots that would fail at booking time.
 */
function canSatisfyAssignment(
	availableSchedulerIds: number[],
	requiredRoleIds: number[],
	minSchedulers: number,
	userRoleMap: Map<number, Set<number>>,
): boolean {
	const usedIds = new Set<number>();
	const coveredRoles = new Set<number>();

	// First pass: greedily assign schedulers to cover required roles
	for (const roleId of requiredRoleIds) {
		if (coveredRoles.has(roleId)) continue;

		const candidate = availableSchedulerIds.find((id) => {
			if (usedIds.has(id)) return false;
			const roles = userRoleMap.get(id);
			return roles?.has(roleId) ?? false;
		});

		if (candidate === undefined) return false; // Cannot cover this role

		usedIds.add(candidate);
		const candidateRoles = userRoleMap.get(candidate);
		if (candidateRoles) {
			for (const r of Array.from(candidateRoles)) {
				if (requiredRoleIds.includes(r)) {
					coveredRoles.add(r);
				}
			}
		}
	}

	// Second pass: fill remaining slots up to minSchedulers
	let assigned = usedIds.size;
	if (assigned < minSchedulers) {
		for (const id of availableSchedulerIds) {
			if (usedIds.has(id)) continue;
			assigned++;
			if (assigned >= minSchedulers) break;
		}
	}

	return assigned >= minSchedulers;
}
