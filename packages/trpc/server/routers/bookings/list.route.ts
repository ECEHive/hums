import { type Prisma, prisma } from "@ecehive/prisma";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZListSchema = z.object({
	limit: z.number().min(1).max(100).optional(),
	offset: z.number().min(0).optional(),
	instantEventTypeId: z.number().min(1).optional(),
	requestorId: z.number().min(1).optional(),
	fromDate: z.date().optional(),
	toDate: z.date().optional(),
});

export type TListSchema = z.infer<typeof ZListSchema>;

export type TListOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TListSchema;
};

export async function listHandler(options: TListOptions) {
	const {
		limit = 10,
		offset = 0,
		instantEventTypeId,
		requestorId,
		fromDate,
		toDate,
	} = options.input;

	const where: Prisma.InstantEventBookingWhereInput = {};

	if (instantEventTypeId) {
		where.instantEventTypeId = instantEventTypeId;
	}

	if (requestorId) {
		where.requestorId = requestorId;
	}

	if (fromDate || toDate) {
		where.startTime = {};
		if (fromDate) {
			where.startTime.gte = fromDate;
		}
		if (toDate) {
			where.startTime.lte = toDate;
		}
	}

	const [bookings, total] = await Promise.all([
		prisma.instantEventBooking.findMany({
			where,
			include: {
				instantEventType: { select: { id: true, name: true } },
				requestor: { select: { id: true, name: true, username: true } },
				schedulers: { select: { id: true, name: true, username: true } },
			},
			orderBy: { startTime: "desc" },
			skip: offset,
			take: limit,
		}),
		prisma.instantEventBooking.count({ where }),
	]);

	return { bookings, total };
}
