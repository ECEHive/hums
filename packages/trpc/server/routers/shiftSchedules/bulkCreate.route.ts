import {
	generateShiftScheduleShiftOccurrences,
	TIME_REGEX,
	timeToSeconds,
} from "@ecehive/features";
import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

const timeStringSchema = z.string().regex(TIME_REGEX, "Invalid time format");

export const ZBulkCreateSchema = z.object({
	shiftTypeIds: z.array(z.number().min(1)).min(1),
	slots: z.number().min(1).max(100).default(1),
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
	const { shiftTypeIds, slots, schedules } = options.input;

	return await prisma.$transaction(async (tx) => {
		// Verify all shift types exist
		const shiftTypes = await tx.shiftType.findMany({
			where: { id: { in: shiftTypeIds } },
		});

		if (shiftTypes.length !== shiftTypeIds.length) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "One or more shift types not found",
			});
		}

		// Build all schedules to create
		const schedulesToCreate = [];
		for (const shiftTypeId of shiftTypeIds) {
			for (const schedule of schedules) {
				schedulesToCreate.push({
					shiftTypeId,
					slots,
					dayOfWeek: schedule.dayOfWeek,
					startTime: schedule.startTime,
					endTime: schedule.endTime,
				});
			}
		}

		// Find existing schedules to skip them
		const existingSchedules = await tx.shiftSchedule.findMany({
			where: {
				OR: schedulesToCreate.map((s) => ({
					shiftTypeId: s.shiftTypeId,
					dayOfWeek: s.dayOfWeek,
					startTime: s.startTime,
				})),
			},
			select: {
				id: true,
				shiftTypeId: true,
				dayOfWeek: true,
				startTime: true,
			},
		});

		// Create a Set for quick lookup of existing schedules
		const existingKeys = new Set(
			existingSchedules.map(
				(s) => `${s.shiftTypeId}-${s.dayOfWeek}-${s.startTime}`,
			),
		);

		// Filter out schedules that already exist
		const newSchedules = schedulesToCreate.filter(
			(s) =>
				!existingKeys.has(`${s.shiftTypeId}-${s.dayOfWeek}-${s.startTime}`),
		);

		// Insert only new schedules
		const insertedSchedules = [];
		for (const schedule of newSchedules) {
			const inserted = await tx.shiftSchedule.create({
				data: schedule,
			});
			insertedSchedules.push(inserted);
		}

		// Generate shift occurrences for each inserted schedule
		for (const schedule of insertedSchedules) {
			await generateShiftScheduleShiftOccurrences(tx, schedule.id);
		}

		return { shiftSchedules: insertedSchedules };
	});
}
