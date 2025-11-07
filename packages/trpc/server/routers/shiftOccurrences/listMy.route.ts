import { prisma } from "@ecehive/prisma";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZListMySchema = z.object({
	periodId: z.number().min(1),
	limit: z.number().min(1).max(100).optional(),
	offset: z.number().min(0).optional(),
});

export type TListMySchema = z.infer<typeof ZListMySchema>;

export type TListMyOptions = {
	ctx: TPermissionProtectedProcedureContext;
	input: TListMySchema;
};

/**
 * List shift occurrences for the current user in a specific period
 */
export async function listMyHandler(options: TListMyOptions) {
	const { periodId, limit = 50, offset = 0 } = options.input;
	const userId = options.ctx.userId;

	// Get all shift occurrences for the user in this period
	const [occurrences, total] = await Promise.all([
		prisma.shiftOccurrence.findMany({
			where: {
				users: {
					some: {
						id: userId,
					},
				},
				shiftSchedule: {
					shiftType: {
						periodId,
					},
				},
			},
			include: {
				shiftSchedule: {
					include: {
						shiftType: true,
					},
				},
				users: {
					select: {
						id: true,
						name: true,
					},
				},
			},
			orderBy: {
				timestamp: "asc",
			},
			skip: offset,
			take: limit,
		}),
		prisma.shiftOccurrence.count({
			where: {
				users: {
					some: {
						id: userId,
					},
				},
				shiftSchedule: {
					shiftType: {
						periodId,
					},
				},
			},
		}),
	]);

	// Map to a cleaner format
	const mappedOccurrences = occurrences.map((occ) => ({
		id: occ.id,
		timestamp: occ.timestamp,
		slot: occ.slot,
		shiftScheduleId: occ.shiftScheduleId,
		shiftTypeName: occ.shiftSchedule.shiftType.name,
		shiftTypeLocation: occ.shiftSchedule.shiftType.location,
		shiftTypeColor: occ.shiftSchedule.shiftType.color,
		startTime: occ.shiftSchedule.startTime,
		endTime: occ.shiftSchedule.endTime,
		dayOfWeek: occ.shiftSchedule.dayOfWeek,
		users: occ.users,
	}));

	return {
		occurrences: mappedOccurrences,
		total,
	};
}
