import {
	assertCanAccessPeriod,
	getUserWithRoles,
	type PeriodWithRoleIds,
} from "@ecehive/features";
import { type Prisma, prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import z from "zod";
import type { TProtectedProcedureContext } from "../../trpc";
import { isWithinModifyWindow } from "./utils";

export const ZListMakeupOptionsSchema = z.object({
	periodId: z.number().min(1),
	shiftTypeId: z.number().min(1).optional(),
	dateFrom: z.coerce.date().optional(),
	dateTo: z.coerce.date().optional(),
	startHourFrom: z.number().int().min(0).max(23).optional(),
	collapseSlots: z.boolean().optional(),
	limit: z.number().min(1).max(50).optional(),
	offset: z.number().min(0).optional(),
});

export const ZListMakeupStartHoursSchema = z.object({
	periodId: z.number().min(1),
	shiftTypeId: z.number().min(1).optional(),
});

export type TListMakeupOptionsSchema = z.infer<typeof ZListMakeupOptionsSchema>;
export type TListMakeupStartHoursSchema = z.infer<
	typeof ZListMakeupStartHoursSchema
>;

export type TListMakeupOptions = {
	ctx: TProtectedProcedureContext;
	input: TListMakeupOptionsSchema;
};

export type TListMakeupStartHours = {
	ctx: TProtectedProcedureContext;
	input: TListMakeupStartHoursSchema;
};

async function getAccessiblePeriod(
	ctx: TProtectedProcedureContext,
	periodId: number,
) {
	const userId = ctx.user.id;

	const [period, user] = await Promise.all([
		prisma.period.findUnique({
			where: { id: periodId },
			select: {
				id: true,
				scheduleModifyStart: true,
				scheduleModifyEnd: true,
				roles: {
					select: { id: true },
				},
			},
		}),
		getUserWithRoles(prisma, userId),
	]);

	if (!period) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Selected period was not found",
		});
	}

	if (!user) {
		throw new TRPCError({
			code: "UNAUTHORIZED",
			message: "User not found",
		});
	}

	const userRoleIds = new Set(user.roles.map((role) => role.id));
	const periodForAccess: PeriodWithRoleIds = {
		id: period.id,
		roles: period.roles,
	};
	assertCanAccessPeriod(periodForAccess, userRoleIds, {
		isSystemUser: ctx.user.isSystemUser,
	});

	return period;
}

function getHourFromTimeString(time: string) {
	const [hourValue] = time.split(":");
	const parsedHour = Number.parseInt(hourValue ?? "", 10);
	return Number.isNaN(parsedHour) ? null : parsedHour;
}

export async function listMakeupStartHoursHandler(
	options: TListMakeupStartHours,
) {
	const { periodId, shiftTypeId } = options.input;

	await getAccessiblePeriod(options.ctx, periodId);

	const schedules = await prisma.shiftSchedule.findMany({
		where: {
			shiftType: {
				periodId,
				canSelfAssign: true,
				...(shiftTypeId ? { id: shiftTypeId } : {}),
			},
		},
		select: {
			startTime: true,
		},
		distinct: ["startTime"],
		orderBy: {
			startTime: "asc",
		},
	});

	const startHours = schedules
		.map((schedule) => getHourFromTimeString(schedule.startTime))
		.filter((hour): hour is number => hour !== null)
		.filter((hour, index, array) => array.indexOf(hour) === index)
		.sort((a, b) => a - b);

	return { startHours };
}

export async function listMakeupOptionsHandler(options: TListMakeupOptions) {
	const {
		periodId,
		shiftTypeId,
		dateFrom,
		dateTo,
		startHourFrom,
		collapseSlots = false,
		limit = 10,
		offset = 0,
	} = options.input;
	const userId = options.ctx.user.id;
	const period = await getAccessiblePeriod(options.ctx, periodId);

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

	const startTimeFilter =
		typeof startHourFrom === "number"
			? {
					gte: `${startHourFrom.toString().padStart(2, "0")}:00`,
					lt: `${Math.min(startHourFrom + 1, 24)
						.toString()
						.padStart(2, "0")}:00`,
				}
			: undefined;

	const where: Prisma.ShiftOccurrenceWhereInput = {
		timestamp: {
			gt: now,
			...(dateFrom ? { gte: dateFrom > now ? dateFrom : now } : {}),
			...(dateTo ? { lte: dateTo } : {}),
		},
		users: {
			none: {},
		},
		shiftSchedule: {
			...(startTimeFilter ? { startTime: startTimeFilter } : {}),
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

	const allOccurrences = await prisma.shiftOccurrence.findMany({
		where,
		orderBy: [{ timestamp: "asc" }, { slot: "asc" }],
		include: {
			shiftSchedule: {
				include: {
					shiftType: true,
				},
			},
		},
	});

	const normalizedOccurrences = collapseSlots
		? Array.from(
				allOccurrences
					.reduce((map, occurrence) => {
						const key = [
							occurrence.shiftScheduleId,
							occurrence.shiftSchedule.shiftType.id,
							occurrence.timestamp.toISOString(),
							occurrence.shiftSchedule.startTime,
							occurrence.shiftSchedule.endTime,
						].join(":");

						const existing = map.get(key);
						if (!existing || occurrence.slot < existing.slot) {
							map.set(key, occurrence);
						}

						return map;
					}, new Map<number | string, (typeof allOccurrences)[number]>())
					.values(),
			)
		: allOccurrences;

	const total = normalizedOccurrences.length;
	const paginatedOccurrences = normalizedOccurrences.slice(
		offset,
		offset + limit,
	);

	const occurrencesForClient = paginatedOccurrences.map((occurrence) => ({
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
