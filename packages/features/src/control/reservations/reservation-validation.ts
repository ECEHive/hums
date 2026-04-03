import type { ReservationStatus } from "@ecehive/prisma";
import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import { ConfigService } from "../../config";

/**
 * Validates that a user can reserve a given control point during the specified time window.
 * Checks: point is reservable, user has reservation roles, no time conflicts,
 * max reservations per user, and max reservation duration.
 */
export async function validateReservation(options: {
	controlPointId: string;
	userId: number;
	startTime: Date;
	endTime: Date;
	excludeReservationId?: string;
}) {
	const { controlPointId, userId, startTime, endTime, excludeReservationId } =
		options;

	if (startTime >= endTime) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Start time must be before end time",
		});
	}

	if (startTime < new Date()) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Cannot create a reservation in the past",
		});
	}

	const point = await prisma.controlPoint.findUnique({
		where: { id: controlPointId },
		include: {
			authorizedRoles: { select: { id: true } },
			reservationRoles: { select: { id: true } },
		},
	});

	if (!point) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Control point not found",
		});
	}

	if (!point.isActive) {
		throw new TRPCError({
			code: "PRECONDITION_FAILED",
			message: "Control point is not active",
		});
	}

	if (!point.canBeReserved) {
		throw new TRPCError({
			code: "PRECONDITION_FAILED",
			message: "This control point cannot be reserved",
		});
	}

	// Check authorized roles and reservation roles
	const needsRoleCheck =
		point.authorizedRoles.length > 0 || point.reservationRoles.length > 0;
	if (needsRoleCheck) {
		const userRoles = await prisma.role.findMany({
			where: { users: { some: { id: userId } } },
			select: { id: true },
		});
		const userRoleIds = new Set(userRoles.map((r) => r.id));

		if (point.authorizedRoles.length > 0) {
			const hasAuthorizedRole = point.authorizedRoles.some((r) =>
				userRoleIds.has(r.id),
			);
			if (!hasAuthorizedRole) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message:
						"You do not have the required role to reserve this equipment",
				});
			}
		}

		if (point.reservationRoles.length > 0) {
			const hasReservationRole = point.reservationRoles.some((r) =>
				userRoleIds.has(r.id),
			);
			if (!hasReservationRole) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message:
						"You do not have the required role to reserve this equipment",
				});
			}
		}
	}

	// Check max reservation duration
	const durationMinutes =
		(endTime.getTime() - startTime.getTime()) / (1000 * 60);
	if (
		point.maxReservationMinutes &&
		durationMinutes > point.maxReservationMinutes
	) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: `Reservation duration cannot exceed ${point.maxReservationMinutes} minutes for this control point`,
		});
	}

	// Check max reservations per user (global config)
	const maxReservationsPerUser = await ConfigService.get<number>(
		"reservations.max_per_user",
	);
	if (maxReservationsPerUser != null) {
		const activeReservationStatuses: ReservationStatus[] = [
			"PENDING",
			"ACTIVE",
		];
		const existingCount = await prisma.reservation.count({
			where: {
				userId,
				status: { in: activeReservationStatuses },
				...(excludeReservationId ? { id: { not: excludeReservationId } } : {}),
			},
		});
		if (existingCount >= maxReservationsPerUser) {
			throw new TRPCError({
				code: "PRECONDITION_FAILED",
				message: `You cannot have more than ${maxReservationsPerUser} active or upcoming reservations`,
			});
		}
	}

	// Check for overlapping reservations on the same control point
	const nonConflictStatuses: ReservationStatus[] = ["CANCELLED", "NO_SHOW"];
	const overlapping = await prisma.reservation.findFirst({
		where: {
			controlPointId,
			status: { notIn: nonConflictStatuses },
			startTime: { lt: endTime },
			endTime: { gt: startTime },
			...(excludeReservationId ? { id: { not: excludeReservationId } } : {}),
		},
	});

	if (overlapping) {
		throw new TRPCError({
			code: "CONFLICT",
			message:
				"This time slot conflicts with an existing reservation for this control point",
		});
	}
}

/**
 * Gets the active or upcoming reservation for a control point, if any.
 * Used during operate to enforce reservation exclusivity.
 */
export async function getActiveReservationForControlPoint(
	controlPointId: string,
) {
	const now = new Date();
	const activeStatuses: ReservationStatus[] = ["PENDING", "ACTIVE"];

	return prisma.reservation.findFirst({
		where: {
			controlPointId,
			status: { in: activeStatuses },
			startTime: { lte: now },
			endTime: { gt: now },
		},
		include: {
			user: { select: { id: true, name: true, username: true } },
		},
	});
}

/**
 * Gets the next upcoming reservation for a control point.
 * Used by the kiosk to display "Reserved in X minutes".
 */
export async function getUpcomingReservationForControlPoint(
	controlPointId: string,
) {
	const now = new Date();
	return prisma.reservation.findFirst({
		where: {
			controlPointId,
			status: "PENDING",
			startTime: { gt: now },
		},
		orderBy: { startTime: "asc" },
		include: {
			user: { select: { id: true, name: true, username: true } },
		},
	});
}
