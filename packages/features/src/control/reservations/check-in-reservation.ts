import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";

/**
 * Check in (start) a reservation. Called when the user turns on the control point
 * during their reservation window.
 */
export async function checkInReservation(reservationId: string) {
	const reservation = await prisma.reservation.findUnique({
		where: { id: reservationId },
	});

	if (!reservation) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Reservation not found",
		});
	}

	if (reservation.status !== "PENDING" && reservation.status !== "ACTIVE") {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Cannot check in to a reservation that is not active or pending",
		});
	}

	if (reservation.checkedInAt) {
		// Already checked in
		return reservation;
	}

	const now = new Date();
	return prisma.reservation.update({
		where: { id: reservationId },
		data: {
			status: "ACTIVE",
			checkedInAt: now,
		},
	});
}

/**
 * Complete a reservation. Called when the reservation end time is reached
 * and the user has checked in.
 */
export async function completeReservation(reservationId: string) {
	return prisma.reservation.update({
		where: { id: reservationId },
		data: { status: "COMPLETED" },
	});
}
