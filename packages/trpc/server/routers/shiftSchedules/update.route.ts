import {
	db,
	periods,
	shiftOccurrences,
	shiftSchedules,
	shiftTypes,
} from "@ecehive/drizzle";
import {
	generateOccurrenceTimestamps,
	parseTime,
	TIME_REGEX,
} from "@ecehive/features";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

const timeStringSchema = z.string().regex(TIME_REGEX, "Invalid time format");

export const ZUpdateSchema = z
	.object({
		id: z.number().min(1),
		shiftTypeId: z.number().min(1).optional(),
		dayOfWeek: z.number().min(0).max(6).optional(),
		startTime: timeStringSchema.optional(),
		endTime: timeStringSchema.optional(),
	})
	.superRefine((data, ctx) => {
		if (data.startTime && data.endTime) {
			const startSeconds = timeToSeconds(data.startTime);
			const endSeconds = timeToSeconds(data.endTime);

			if (startSeconds >= endSeconds) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: "startTime must be before endTime",
					path: ["startTime"],
				});
			}
		}
	});

export type TUpdateSchema = z.infer<typeof ZUpdateSchema>;

export type TUpdateOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TUpdateSchema;
};

export async function updateHandler(options: TUpdateOptions) {
	const { id, shiftTypeId, dayOfWeek, startTime, endTime } = options.input;

	const [existing] = await db
		.select({
			schedule: shiftSchedules,
			periodId: periods.id,
			periodStart: periods.start,
			periodEnd: periods.end,
		})
		.from(shiftSchedules)
		.innerJoin(shiftTypes, eq(shiftSchedules.shiftTypeId, shiftTypes.id))
		.innerJoin(periods, eq(shiftTypes.periodId, periods.id))
		.where(eq(shiftSchedules.id, id))
		.limit(1);

	if (!existing) {
		return { shiftSchedule: undefined, occurrences: [] };
	}

	const currentSchedule = existing.schedule;
	let targetPeriod = {
		id: existing.periodId,
		start: existing.periodStart,
		end: existing.periodEnd,
	};

	if (
		shiftTypeId !== undefined &&
		shiftTypeId !== currentSchedule.shiftTypeId
	) {
		const [lookup] = await db
			.select({
				periodId: periods.id,
				periodStart: periods.start,
				periodEnd: periods.end,
			})
			.from(shiftTypes)
			.innerJoin(periods, eq(shiftTypes.periodId, periods.id))
			.where(eq(shiftTypes.id, shiftTypeId))
			.limit(1);

		if (!lookup) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "Shift type not found",
			});
		}

		targetPeriod = {
			id: lookup.periodId,
			start: lookup.periodStart,
			end: lookup.periodEnd,
		};
	}

	const nextStartTime = startTime ?? currentSchedule.startTime;
	const nextEndTime = endTime ?? currentSchedule.endTime;

	if (timeToSeconds(nextStartTime) >= timeToSeconds(nextEndTime)) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "startTime must be before endTime",
		});
	}

	const nextDayOfWeek = dayOfWeek ?? currentSchedule.dayOfWeek;
	const nextShiftTypeId = shiftTypeId ?? currentSchedule.shiftTypeId;

	return await db.transaction(async (tx) => {
		const updates: Partial<typeof shiftSchedules.$inferInsert> = {
			updatedAt: new Date(),
		};

		if (shiftTypeId !== undefined) {
			updates.shiftTypeId = shiftTypeId;
		}

		if (dayOfWeek !== undefined) {
			updates.dayOfWeek = dayOfWeek;
		}

		if (startTime !== undefined) {
			updates.startTime = startTime;
		}

		if (endTime !== undefined) {
			updates.endTime = endTime;
		}

		const updatedRows = await tx
			.update(shiftSchedules)
			.set(updates)
			.where(eq(shiftSchedules.id, id))
			.returning();

		const updated = updatedRows[0];

		if (!updated) {
			return { shiftSchedule: undefined, occurrences: [] };
		}

		await tx
			.delete(shiftOccurrences)
			.where(eq(shiftOccurrences.shiftScheduleId, updated.id));

		const occurrences = generateOccurrenceTimestamps({
			period: targetPeriod,
			schedule: {
				id: updated.id,
				dayOfWeek: nextDayOfWeek,
				startTime: updated.startTime,
			},
		});

		if (occurrences.length === 0) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message:
					"Shift schedule does not produce any occurrences within the period",
			});
		}

		const insertedOccurrences = await tx
			.insert(shiftOccurrences)
			.values(
				occurrences.map((timestamp) => ({
					shiftScheduleId: updated.id,
					timestamp,
				})),
			)
			.returning();

		return {
			shiftSchedule: {
				...updated,
				shiftTypeId: nextShiftTypeId,
				dayOfWeek: nextDayOfWeek,
			},
			occurrences: insertedOccurrences,
		};
	});
}

function timeToSeconds(time: string) {
	const { hours, minutes, seconds } = parseTime(time);
	return hours * 3600 + minutes * 60 + seconds;
}
