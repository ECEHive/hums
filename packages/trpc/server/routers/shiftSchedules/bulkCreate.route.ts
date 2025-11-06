import {
	generateShiftScheduleShiftOccurrences,
	parseTimeString,
} from "@ecehive/features";
import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

const TIME_REGEX = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/;
const timeStringSchema = z.string().regex(TIME_REGEX, "Invalid time format");

export const ZBulkCreateSchema = z.object({
	shiftTypeId: z.number().min(1),
	schedules: z
		.array(
			z
				.object({
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
				}),
		)
		.min(1)
		.max(100),
});

export type TBulkCreateSchema = z.infer<typeof ZBulkCreateSchema>;

export type TBulkCreateOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TBulkCreateSchema;
};

export async function bulkCreateHandler(options: TBulkCreateOptions) {
	const { shiftTypeId, schedules } = options.input;

	return await prisma.$transaction(async (tx) => {
		// Verify the shift type exists
		const shiftType = await tx.shiftType.findUnique({
			where: { id: shiftTypeId },
		});

		if (!shiftType) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "Shift type not found",
			});
		}

		// Insert all schedules
		const insertedSchedules = [];
		for (const schedule of schedules) {
			const inserted = await tx.shiftSchedule.create({
				data: {
					shiftTypeId,
					dayOfWeek: schedule.dayOfWeek,
					startTime: schedule.startTime,
					endTime: schedule.endTime,
				},
			});
			insertedSchedules.push(inserted);
		}

		// Generate shift occurrences for each schedule
		for (const schedule of insertedSchedules) {
			await generateShiftScheduleShiftOccurrences(tx, schedule.id);
		}

		return { shiftSchedules: insertedSchedules };
	});
}

function timeToSeconds(time: string) {
	const { hours, minutes, seconds } = parseTimeString(time);
	return hours * 3600 + minutes * 60 + seconds;
}
