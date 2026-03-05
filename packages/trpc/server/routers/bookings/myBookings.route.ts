import { prisma } from "@ecehive/prisma";
import z from "zod";
import type { TProtectedProcedureContext } from "../../trpc";

export const ZMyBookingsSchema = z.object({
	limit: z.number().min(1).max(100).optional(),
	offset: z.number().min(0).optional(),
	upcoming: z.boolean().optional(),
});

export type TMyBookingsSchema = z.infer<typeof ZMyBookingsSchema>;

export type TMyBookingsOptions = {
	ctx: TProtectedProcedureContext;
	input: TMyBookingsSchema;
};

export async function myBookingsHandler(options: TMyBookingsOptions) {
	const { limit = 10, offset = 0, upcoming } = options.input;
	const userId = options.ctx.user.id;

	const where: {
		OR: { requestorId?: number; schedulers?: { some: { id: number } } }[];
		startTime?: { gte: Date };
	} = {
		OR: [{ requestorId: userId }, { schedulers: { some: { id: userId } } }],
	};

	if (upcoming) {
		where.startTime = { gte: new Date() };
	}

	const [bookings, total] = await Promise.all([
		prisma.instantEventBooking.findMany({
			where,
			include: {
				instantEventType: { select: { id: true, name: true } },
				requestor: { select: { id: true, name: true, username: true } },
				schedulers: { select: { id: true, name: true, username: true } },
			},
			orderBy: { startTime: upcoming ? "asc" : "desc" },
			skip: offset,
			take: limit,
		}),
		prisma.instantEventBooking.count({ where }),
	]);

	return { bookings, total };
}
