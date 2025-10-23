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

export const ZUpdateSchema = z
	.object({
		id: z.number().min(1),
		shiftTypeId: z.number().min(1).optional(),
		slots: z.number().min(1).optional(),
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
	const { id, shiftTypeId, slots, dayOfWeek, startTime, endTime } =
		options.input;

	const [existing] = await db
		.select()
		.from(shiftSchedules)
		.where(eq(shiftSchedules.id, id))
		.limit(1);

	if (!existing) {
		return { shiftSchedule: undefined };
	}

	// If changing shift type, verify the new shift type exists
	if (shiftTypeId !== undefined && shiftTypeId !== existing.shiftTypeId) {
		const [shiftType] = await db
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
	}

	const nextStartTime = startTime ?? existing.startTime;
	const nextEndTime = endTime ?? existing.endTime;

	if (timeToSeconds(nextStartTime) >= timeToSeconds(nextEndTime)) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "startTime must be before endTime",
		});
	}

	return await db.transaction(async (tx) => {
		const updates: Partial<typeof shiftSchedules.$inferInsert> = {
			updatedAt: new Date(),
		};

		if (shiftTypeId !== undefined) {
			updates.shiftTypeId = shiftTypeId;
		}

		if (slots !== undefined) {
			updates.slots = slots;
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

		await tx
			.update(shiftSchedules)
			.set(updates)
			.where(eq(shiftSchedules.id, id));

		const updated = await tx.query.shiftSchedules.findFirst({
			where: eq(shiftSchedules.id, id),
		});

		if (!updated) {
			return { shiftSchedule: undefined };
		}

		// Re-generate shift occurrences for this schedule
		// This will create new occurrences with the updated slot count
		// and remove obsolete occurrences
		await generateShiftScheduleShiftOccurrences(tx, updated.id);

		return { shiftSchedule: updated };
	});
}

function timeToSeconds(time: string) {
	const { hours, minutes, seconds } = parseTimeString(time);
	return hours * 3600 + minutes * 60 + seconds;
}
