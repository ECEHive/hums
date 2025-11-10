import { prisma } from "@ecehive/prisma";
import z from "zod";
import type { TProtectedProcedureContext } from "../../trpc";

export const ZListMySchema = z.object({
	limit: z.number().min(1).max(100).optional(),
	offset: z.number().min(0).optional(),
	periodId: z.number().min(1).optional(),
});

export type TListMySchema = z.infer<typeof ZListMySchema>;

export type TListMyOptions = {
	ctx: TProtectedProcedureContext;
	input: TListMySchema;
};

export async function listMyHandler(options: TListMyOptions) {
	const userId = options.ctx.user.id;
	const { limit = 50, offset = 0, periodId } = options.input;

	// Build where clause
	const where: {
		userId: number;
		shiftOccurrence?: {
			shiftSchedule?: {
				shiftType?: {
					periodId?: number;
				};
			};
		};
	} = { userId };

	if (periodId) {
		where.shiftOccurrence = {
			shiftSchedule: {
				shiftType: {
					periodId,
				},
			},
		};
	}

	const [attendances, total] = await Promise.all([
		prisma.shiftAttendance.findMany({
			where,
			orderBy: { createdAt: "desc" },
			skip: offset,
			take: limit,
			select: {
				id: true,
				status: true,
				timeIn: true,
				timeOut: true,
				createdAt: true,
				shiftOccurrence: {
					select: {
						id: true,
						timestamp: true,
						shiftSchedule: {
							select: {
								id: true,
								dayOfWeek: true,
								startTime: true,
								endTime: true,
								shiftType: {
									select: {
										id: true,
										name: true,
										location: true,
										color: true,
										icon: true,
										period: {
											select: {
												id: true,
												name: true,
											},
										},
									},
								},
							},
						},
					},
				},
			},
		}),
		prisma.shiftAttendance.count({ where }),
	]);

	return {
		attendances,
		total,
	};
}
