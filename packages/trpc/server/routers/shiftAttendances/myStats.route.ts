import { calculateAttendanceStats } from "@ecehive/features";
import { prisma } from "@ecehive/prisma";
import z from "zod";
import type { TProtectedProcedureContext } from "../../trpc";

export const ZMyStatsSchema = z.object({
	periodId: z.number().min(1).optional(),
});

export type TMyStatsSchema = z.infer<typeof ZMyStatsSchema>;

export type TMyStatsOptions = {
	ctx: TProtectedProcedureContext;
	input: TMyStatsSchema;
};

export async function myStatsHandler(options: TMyStatsOptions) {
	const userId = options.ctx.user.id;
	const { periodId } = options.input;

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

	// Get all attendances for the user
	const attendances = await prisma.shiftAttendance.findMany({
		where,
		select: {
			id: true,
			status: true,
			timeIn: true,
			timeOut: true,
			didArriveLate: true,
			didLeaveEarly: true,
			isMakeup: true,
			isExcused: true,
			shiftOccurrence: {
				select: {
					timestamp: true,
					shiftSchedule: {
						select: {
							startTime: true,
							endTime: true,
						},
					},
				},
			},
		},
	});

	// Use the centralized calculation utility
	const stats = calculateAttendanceStats(attendances);

	return stats;
}
