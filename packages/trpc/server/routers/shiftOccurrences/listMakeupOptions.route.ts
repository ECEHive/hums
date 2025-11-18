import { type Prisma, prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";
import { isWithinModifyWindow } from "./utils";

export const ZListMakeupOptionsSchema = z.object({
	periodId: z.number().min(1),
	shiftTypeId: z.number().min(1).optional(),
	limit: z.number().min(1).max(50).optional(),
	offset: z.number().min(0).optional(),
});

export type TListMakeupOptionsSchema = z.infer<typeof ZListMakeupOptionsSchema>;

export type TListMakeupOptions = {
	ctx: TPermissionProtectedProcedureContext;
	input: TListMakeupOptionsSchema;
};

export async function listMakeupOptionsHandler(options: TListMakeupOptions) {
	const { periodId, shiftTypeId, limit = 10, offset = 0 } = options.input;
	const userId = options.ctx.user.id;

	const period = await prisma.period.findUnique({
		where: { id: periodId },
		select: {
			id: true,
			scheduleModifyStart: true,
			scheduleModifyEnd: true,
		},
	});

	if (!period) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Selected period was not found",
		});
	}

	const now = new Date();

	const conflictingTimestamps = await prisma.shiftOccurrence.findMany({
		where: {
			timestamp: {
				gt: now,
			},
			users: {
				some: { id: userId },
			},
		},
		select: { timestamp: true },
		distinct: ["timestamp"],
	});

	const blockedTimestamps = conflictingTimestamps.map(
		(occurrence) => occurrence.timestamp,
	);

	const where: Prisma.ShiftOccurrenceWhereInput = {
		timestamp: {
			gt: now,
		},
		users: {
			none: {},
		},
		shiftSchedule: {
			shiftType: {
				periodId,
				canSelfAssign: true,
				...(shiftTypeId ? { id: shiftTypeId } : {}),
			},
		},
	};

	if (blockedTimestamps.length > 0) {
		where.NOT = {
			timestamp: {
				in: blockedTimestamps,
			},
		};
	}

	const [occurrences, total] = await Promise.all([
		prisma.shiftOccurrence.findMany({
			where,
			orderBy: { timestamp: "asc" },
			skip: offset,
			take: limit,
			include: {
				shiftSchedule: {
					include: {
						shiftType: true,
					},
				},
			},
		}),
		prisma.shiftOccurrence.count({ where }),
	]);

	const occurrencesForClient = occurrences.map((occurrence) => ({
		id: occurrence.id,
		timestamp: occurrence.timestamp,
		slot: occurrence.slot,
		shiftScheduleId: occurrence.shiftScheduleId,
		shiftTypeId: occurrence.shiftSchedule.shiftType.id,
		shiftTypeName: occurrence.shiftSchedule.shiftType.name,
		shiftTypeLocation: occurrence.shiftSchedule.shiftType.location,
		shiftTypeColor: occurrence.shiftSchedule.shiftType.color,
		startTime: occurrence.shiftSchedule.startTime,
		endTime: occurrence.shiftSchedule.endTime,
		dayOfWeek: occurrence.shiftSchedule.dayOfWeek,
	}));

	return {
		occurrences: occurrencesForClient,
		total,
		modificationWindow: {
			start: period.scheduleModifyStart,
			end: period.scheduleModifyEnd,
			isOpen: isWithinModifyWindow(period, now),
		},
	};
}
