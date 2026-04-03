import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";

export async function getReservation(id: string) {
	const reservation = await prisma.reservation.findUnique({
		where: { id },
		include: {
			controlPoint: {
				select: {
					id: true,
					name: true,
					location: true,
					controlClass: true,
					description: true,
				},
			},
			user: {
				select: { id: true, name: true, username: true, email: true },
			},
		},
	});

	if (!reservation) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Reservation not found",
		});
	}

	return reservation;
}
