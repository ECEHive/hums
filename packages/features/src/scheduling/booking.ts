import type { Prisma } from "@ecehive/prisma";
import { lockInstantEventType } from "./locking";
import { timeToMinutes } from "./slots";

/**
 * Result of a booking attempt.
 */
export type BookingResult = {
	success: boolean;
	bookingId?: number;
	error?: string;
};

/**
 * Select schedulers from the pool based on load balancing strategy.
 * The requestor is excluded from the scheduler pool — schedulers are
 * always distinct from the user requesting the booking.
 */
async function selectSchedulers(
	tx: Prisma.TransactionClient,
	eventType: {
		id: number;
		minSchedulers: number;
		durationMinutes: number;
		loadBalancing: string;
		schedulerRoles: { id: number }[];
		requiredRoles: { id: number }[];
	},
	slotStart: Date,
	slotEnd: Date,
	requestorId: number,
): Promise<number[]> {
	const schedulerRoleIds = eventType.schedulerRoles.map((r) => r.id);
	const requiredRoleIds = eventType.requiredRoles.map((r) => r.id);

	// Find eligible schedulers with availability for this slot
	const dayOfWeek = slotStart.getDay();
	const minuteOfDay = slotStart.getHours() * 60 + slotStart.getMinutes();
	const slotEndMinuteOfDay = minuteOfDay + eventType.durationMinutes;

	const eligibleSchedulers = await tx.user.findMany({
		where: {
			// Exclude the requestor — they are a participant, not a scheduler
			NOT: { id: requestorId },
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
				some: {
					dayOfWeek,
				},
			},
		},
		select: {
			id: true,
			roles: { select: { id: true } },
			availabilities: {
				where: { dayOfWeek },
				select: {
					startTime: true,
					endTime: true,
				},
			},
			_count: {
				select: {
					assignedBookings: true,
				},
			},
		},
	});

	// Filter to those actually available for this slot
	const availableSchedulers: {
		id: number;
		bookingCount: number;
		roleIds: Set<number>;
	}[] = [];

	for (const scheduler of eligibleSchedulers) {
		// Check availability windows
		const coversSlot = scheduler.availabilities.some((avail) => {
			const startMin = timeToMinutes(avail.startTime);
			const endMin = timeToMinutes(avail.endTime);
			return startMin <= minuteOfDay && endMin >= slotEndMinuteOfDay;
		});
		if (!coversSlot) continue;

		// Check for conflicting bookings
		const conflictingBookings = await tx.instantEventBooking.count({
			where: {
				schedulers: { some: { id: scheduler.id } },
				startTime: { lt: slotEnd },
				endTime: { gt: slotStart },
			},
		});
		if (conflictingBookings > 0) continue;

		availableSchedulers.push({
			id: scheduler.id,
			bookingCount: scheduler._count.assignedBookings,
			roleIds: new Set(scheduler.roles.map((r) => r.id)),
		});
	}

	if (availableSchedulers.length < eventType.minSchedulers) {
		return [];
	}

	// Sort by load balancing strategy
	const sorted = [...availableSchedulers];
	switch (eventType.loadBalancing) {
		case "round_robin":
		case "even_distribution":
			// Sort by booking count ascending (fewest assignments first)
			sorted.sort((a, b) => a.bookingCount - b.bookingCount);
			break;
		default:
			// No specific ordering
			break;
	}

	// If required roles are specified, use greedy assignment to cover all roles
	if (requiredRoleIds.length > 0) {
		return assignWithRequiredRoles(
			sorted,
			requiredRoleIds,
			eventType.minSchedulers,
		);
	}

	// Otherwise, just pick the first N schedulers
	return sorted.slice(0, eventType.minSchedulers).map((s) => s.id);
}

/**
 * Greedy assignment that ensures all required roles are covered.
 */
function assignWithRequiredRoles(
	candidates: { id: number; bookingCount: number; roleIds: Set<number> }[],
	requiredRoleIds: number[],
	minSchedulers: number,
): number[] {
	const assigned: number[] = [];
	const coveredRoles = new Set<number>();
	const usedIds = new Set<number>();

	// First pass: greedily assign users that cover uncovered required roles
	for (const roleId of requiredRoleIds) {
		if (coveredRoles.has(roleId)) continue;

		const candidate = candidates.find(
			(c) => !usedIds.has(c.id) && c.roleIds.has(roleId),
		);
		if (!candidate) return []; // Cannot satisfy required roles

		assigned.push(candidate.id);
		usedIds.add(candidate.id);
		// Mark all roles this candidate covers
		for (const r of Array.from(candidate.roleIds)) {
			if (requiredRoleIds.includes(r)) {
				coveredRoles.add(r);
			}
		}
	}

	// Fill remaining slots if minSchedulers > assigned count
	while (assigned.length < minSchedulers) {
		const next = candidates.find((c) => !usedIds.has(c.id));
		if (!next) return []; // Not enough schedulers
		assigned.push(next.id);
		usedIds.add(next.id);
	}

	return assigned;
}

/**
 * Atomically create an instant event booking.
 *
 * This function:
 * 1. Acquires a row-level lock on the event type
 * 2. Validates the time slot and booking window
 * 3. Selects schedulers based on rules (excluding the requestor)
 * 4. Verifies no double-booking
 * 5. Creates the booking record
 *
 * Time intervals use half-open semantics [start, end): a booking from
 * 12:30–13:00 does not conflict with one from 13:00–13:30.
 *
 * The requestor is always separate from schedulers. If minSchedulers=2,
 * two distinct scheduler users are assigned in addition to the requestor.
 *
 * Must be called within a Prisma transaction with sufficient isolation.
 */
export async function createInstantEventBooking(
	tx: Prisma.TransactionClient,
	input: {
		instantEventTypeId: number;
		requestorId: number;
		startTime: Date;
	},
): Promise<BookingResult> {
	const { instantEventTypeId, requestorId, startTime } = input;

	// 1. Lock the event type to serialize bookings
	const locked = await lockInstantEventType(tx, instantEventTypeId);
	if (!locked) {
		return { success: false, error: "Event type not found" };
	}

	// 2. Fetch the event type with all configuration
	const eventType = await tx.instantEventType.findUnique({
		where: { id: instantEventTypeId },
		include: {
			schedulerRoles: { select: { id: true } },
			participantRoles: { select: { id: true } },
			requiredRoles: { select: { id: true } },
		},
	});

	if (!eventType || !eventType.isActive) {
		return { success: false, error: "Event type not found or inactive" };
	}

	// Validate booking window
	if (
		eventType.bookingWindowStart &&
		startTime < eventType.bookingWindowStart
	) {
		return { success: false, error: "Start time is before the booking window" };
	}
	if (eventType.bookingWindowEnd) {
		const endTime = new Date(
			startTime.getTime() + eventType.durationMinutes * 60 * 1000,
		);
		if (endTime > eventType.bookingWindowEnd) {
			return {
				success: false,
				error: "Booking extends beyond the booking window",
			};
		}
	}

	// Validate requestor role restrictions (participant roles)
	if (eventType.participantRoles.length > 0) {
		const participantRoleIds = eventType.participantRoles.map((r) => r.id);
		const requestor = await tx.user.findUnique({
			where: { id: requestorId },
			select: { roles: { select: { id: true } } },
		});
		if (!requestor) {
			return { success: false, error: "Requestor not found" };
		}
		const hasRequiredRole = requestor.roles.some((r) =>
			participantRoleIds.includes(r.id),
		);
		if (!hasRequiredRole) {
			return {
				success: false,
				error: "You do not have the required role to book this event type",
			};
		}
	}

	const endTime = new Date(
		startTime.getTime() + eventType.durationMinutes * 60 * 1000,
	);

	// 3. Select schedulers from pool (excluding the requestor)
	const schedulerIds = await selectSchedulers(
		tx,
		eventType,
		startTime,
		endTime,
		requestorId,
	);

	if (schedulerIds.length < eventType.minSchedulers) {
		return {
			success: false,
			error: "Not enough available schedulers for this time slot",
		};
	}

	// 4. Double-check no double booking with a fresh query
	for (const schedulerId of schedulerIds) {
		const conflict = await tx.instantEventBooking.findFirst({
			where: {
				schedulers: { some: { id: schedulerId } },
				startTime: { lt: endTime },
				endTime: { gt: startTime },
			},
		});
		if (conflict) {
			return {
				success: false,
				error: "A scheduler is no longer available for this time slot",
			};
		}
	}

	// 5. Create the booking
	const booking = await tx.instantEventBooking.create({
		data: {
			instantEventTypeId,
			requestorId,
			startTime,
			endTime,
			schedulers: {
				connect: schedulerIds.map((id) => ({ id })),
			},
		},
		include: {
			schedulers: { select: { id: true } },
		},
	});

	// 6. Verify the booking was created with the correct number of schedulers
	if (booking.schedulers.length < eventType.minSchedulers) {
		throw new Error(
			`Booking created with ${booking.schedulers.length} schedulers but minimum is ${eventType.minSchedulers}`,
		);
	}

	return { success: true, bookingId: booking.id };
}
