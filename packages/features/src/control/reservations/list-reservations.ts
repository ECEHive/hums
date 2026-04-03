import type { Prisma, ReservationStatus } from "@ecehive/prisma";
import { prisma } from "@ecehive/prisma";

export interface ListReservationsInput {
	controlPointId?: string;
	userId?: number;
	status?: ReservationStatus | ReservationStatus[];
	from?: Date;
	to?: Date;
	page?: number;
	pageSize?: number;
	orderBy?: "startTime" | "createdAt";
	orderDir?: "asc" | "desc";
}

export async function listReservations(input: ListReservationsInput) {
	const {
		controlPointId,
		userId,
		status,
		from,
		to,
		page = 1,
		pageSize = 25,
		orderBy = "startTime",
		orderDir = "desc",
	} = input;

	const where: Prisma.ReservationWhereInput = {};

	if (controlPointId) {
		where.controlPointId = controlPointId;
	}

	if (userId) {
		where.userId = userId;
	}

	if (status) {
		where.status = Array.isArray(status) ? { in: status } : status;
	}

	if (from || to) {
		where.startTime = {};
		if (from) where.startTime.gte = from;
		if (to) where.startTime.lte = to;
	}

	const [reservations, total] = await Promise.all([
		prisma.reservation.findMany({
			where,
			include: {
				controlPoint: {
					select: { id: true, name: true, location: true, controlClass: true },
				},
				user: {
					select: { id: true, name: true, username: true },
				},
			},
			orderBy: { [orderBy]: orderDir },
			skip: (page - 1) * pageSize,
			take: pageSize,
		}),
		prisma.reservation.count({ where }),
	]);

	return {
		reservations,
		total,
		page,
		pageSize,
		totalPages: Math.ceil(total / pageSize),
	};
}
