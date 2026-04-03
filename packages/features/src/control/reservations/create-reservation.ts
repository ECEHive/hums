import { prisma } from "@ecehive/prisma";
import { validateReservation } from "./reservation-validation";

export interface CreateReservationInput {
	controlPointId: string;
	userId: number;
	startTime: Date;
	endTime: Date;
	notes?: string;
}

export async function createReservation(input: CreateReservationInput) {
	const { controlPointId, userId, startTime, endTime, notes } = input;

	await validateReservation({ controlPointId, userId, startTime, endTime });

	const reservation = await prisma.reservation.create({
		data: {
			controlPointId,
			userId,
			startTime,
			endTime,
			notes,
			status: "PENDING",
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

	return reservation;
}
