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

export const ZCreateSchema = z
	.object({
		shiftTypeId: z.number().min(1),
		dayOfWeek: z.number().min(0).max(6),
		startTime: timeStringSchema,
		endTime: timeStringSchema,
	})
	.superRefine((data, ctx) => {
		const startSeconds = timeToSeconds(data.startTime);
		const endSeconds = timeToSeconds(data.endTime);

		if (startSeconds >= endSeconds) {
			ctx.addIssue({
				code: "custom",
				message: "startTime must be before endTime",
			});
		}
	});

export type TCreateSchema = z.infer<typeof ZCreateSchema>;

export type TCreateOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TCreateSchema;
};

export async function createHandler(options: TCreateOptions) {
	const { shiftTypeId, dayOfWeek, startTime, endTime } = options.input;

	return await db.transaction(async (tx) => {
		const [lookup] = await tx
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

		const insertedSchedules = await tx
			.insert(shiftSchedules)
			.values({ shiftTypeId, dayOfWeek, startTime, endTime })
			.returning();

		const schedule = insertedSchedules[0];

		if (!schedule) {
			return { shiftSchedule: undefined, occurrences: [] };
		}

		const period = {
			id: lookup.periodId,
			start: lookup.periodStart,
			end: lookup.periodEnd,
		};

		const occurrences = generateOccurrenceTimestamps({ period, schedule });

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
					shiftScheduleId: schedule.id,
					timestamp,
				})),
			)
			.returning();

		return { shiftSchedule: schedule, occurrences: insertedOccurrences };
	});
}

function timeToSeconds(time: string) {
	const { hours, minutes, seconds } = parseTime(time);
	return hours * 3600 + minutes * 60 + seconds;
}
