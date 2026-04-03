import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";

export interface CancelReservationInput {
	reservationId: string;
	userId: number;
	isAdmin: boolean;
}

export async function cancelReservation(input: CancelReservationInput) {
	const { reservationId, userId, isAdmin } = input;

	const reservation = await prisma.reservation.findUnique({
		where: { id: reservationId },
	});

	if (!reservation) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Reservation not found",
		});
	}

	if (reservation.status === "CANCELLED") {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Reservation is already cancelled",
		});
	}

	if (reservation.status === "COMPLETED" || reservation.status === "NO_SHOW") {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Cannot cancel a reservation that has already ended",
		});
	}

	// Only the owner or an admin can cancel
	if (reservation.userId !== userId && !isAdmin) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "You can only cancel your own reservations",
		});
	}

	const updated = await prisma.reservation.update({
		where: { id: reservationId },
		data: {
			status: "CANCELLED",
			cancelledAt: new Date(),
			cancelledById: userId,
		},
		include: {
			controlPoint: {
				select: { id: true, name: true, location: true },
			},
			user: {
				select: { id: true, name: true, username: true },
			},
		},
	});

	return updated;
}
