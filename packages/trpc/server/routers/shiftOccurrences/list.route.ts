import { type Prisma, prisma } from "@ecehive/prisma";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZListSchema = z.object({
	limit: z.number().min(1).max(100).optional(),
	offset: z.number().min(0).optional(),
	shiftScheduleId: z.number().min(1).optional(),
	startDate: z.date().optional(),
	endDate: z.date().optional(),
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
		shiftScheduleId,
		startDate,
		endDate,
	} = options.input;

	const where: Prisma.ShiftOccurrenceWhereInput = {};

	if (shiftScheduleId) {
		where.shiftScheduleId = shiftScheduleId;
	}

	if (startDate || endDate) {
		where.timestamp = {};
		if (startDate) {
			where.timestamp.gte = startDate;
		}
		if (endDate) {
			where.timestamp.lte = endDate;
		}
	}

	const [result, total] = await Promise.all([
		prisma.shiftOccurrence.findMany({
			where,
			include: {
				_count: {
					select: { users: true },
				},
			},
			orderBy: { timestamp: "asc" },
			skip: offset,
			take: limit,
		}),
		prisma.shiftOccurrence.count({ where }),
	]);

	const occurrencesWithCounts = result.map((occurrence) => ({
		...occurrence,
		assignedUserCount: occurrence._count.users,
		_count: undefined,
	}));

	return { shiftOccurrences: occurrencesWithCounts, total };
}
