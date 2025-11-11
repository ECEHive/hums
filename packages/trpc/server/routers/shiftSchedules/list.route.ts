import { type Prisma, prisma } from "@ecehive/prisma";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZListSchema = z.object({
	limit: z.number().min(1).max(10000).optional(),
	offset: z.number().min(0).optional(),
	shiftTypeId: z.number().min(1).optional(),
	periodId: z.number().min(1).optional(),
	dayOfWeek: z.number().min(0).max(6).optional(),
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
		shiftTypeId,
		periodId,
		dayOfWeek,
	} = options.input;

	const where: Prisma.ShiftScheduleWhereInput = {};

	if (shiftTypeId) {
		where.shiftTypeId = shiftTypeId;
	}

	if (periodId) {
		where.shiftType = { periodId };
	}

	if (dayOfWeek !== undefined) {
		where.dayOfWeek = dayOfWeek;
	}

	const [result, total] = await Promise.all([
		prisma.shiftSchedule.findMany({
			where,
			include: {
				_count: {
					select: { users: true },
				},
			},
			orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
			skip: offset,
			take: limit,
		}),
		prisma.shiftSchedule.count({ where }),
	]);

	const schedulesWithCounts = result.map((schedule) => ({
		...schedule,
		assignedUserCount: schedule._count.users,
		_count: undefined,
	}));

	return { shiftSchedules: schedulesWithCounts, total };
}
