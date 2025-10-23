import { db, shiftSchedules, shiftTypes } from "@ecehive/drizzle";
import {
	generateShiftScheduleShiftOccurrences,
	parseTimeString,
} from "@ecehive/features";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

const TIME_REGEX = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/;
const timeStringSchema = z.string().regex(TIME_REGEX, "Invalid time format");

export const ZCreateSchema = z
	.object({
		shiftTypeId: z.number().min(1),
		slots: z.number().min(1).max(100).default(1),
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
	const { shiftTypeId, slots, dayOfWeek, startTime, endTime } = options.input;

	return await db.transaction(async (tx) => {
		// Verify the shift type exists
		const [shiftType] = await tx
			.select()
			.from(shiftTypes)
			.where(eq(shiftTypes.id, shiftTypeId))
			.limit(1);

		if (!shiftType) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "Shift type not found",
			});
		}

		try {
			const [schedule] = await tx
				.insert(shiftSchedules)
				.values({ shiftTypeId, slots, dayOfWeek, startTime, endTime })
				.returning();

			if (!schedule) {
				return { shiftSchedule: undefined };
			}

			// Generate shift occurrences for this schedule
			await generateShiftScheduleShiftOccurrences(tx, schedule.id);

			return { shiftSchedule: schedule };
		} catch (error) {
			// Handle duplicate key constraint - check both the error and its cause
			const pgError =
				error &&
				typeof error === "object" &&
				"cause" in error &&
				error.cause &&
				typeof error.cause === "object"
					? error.cause
					: error;

			if (
				pgError &&
				typeof pgError === "object" &&
				"code" in pgError &&
				pgError.code === "23505"
			) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message:
						"A shift schedule already exists for this shift type, day, and start time",
				});
			}
			throw error;
		}
	});
}

function timeToSeconds(time: string) {
	const { hours, minutes, seconds } = parseTimeString(time);
	return hours * 3600 + minutes * 60 + seconds;
}
