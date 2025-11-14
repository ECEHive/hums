import { generatePeriodShiftOccurrences } from "@ecehive/features";
import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZUpdateSchema = z
	.object({
		id: z.number().min(1),
		name: z.string().min(1).max(100).optional(),
		start: z.date().optional(),
		end: z.date().optional(),
		visibleStart: z.date().optional().nullable(),
		visibleEnd: z.date().optional().nullable(),
		scheduleSignupStart: z.date().optional().nullable(),
		scheduleSignupEnd: z.date().optional().nullable(),
		scheduleModifyStart: z.date().optional().nullable(),
		scheduleModifyEnd: z.date().optional().nullable(),
	})
	.superRefine((data, ctx) => {
		// Start must be before end
		if (data.start && data.end && data.start >= data.end) {
			ctx.addIssue({
				code: "custom",
				message: "start must be before end",
				path: ["start"],
			});
		}

		// Visible start must be before visible end
		if (
			data.visibleStart &&
			data.visibleEnd &&
			data.visibleStart >= data.visibleEnd
		) {
			ctx.addIssue({
				code: "custom",
				message: "visibleStart must be before visibleEnd",
				path: ["visibleStart"],
			});
		}

		// Schedule signup start must be before signup end
		if (
			data.scheduleSignupStart &&
			data.scheduleSignupEnd &&
			data.scheduleSignupStart >= data.scheduleSignupEnd
		) {
			ctx.addIssue({
				code: "custom",
				message: "scheduleSignupStart must be before scheduleSignupEnd",
				path: ["scheduleSignupStart"],
			});
		}

		// Schedule modify start must be before modify end
		if (
			data.scheduleModifyStart &&
			data.scheduleModifyEnd &&
			data.scheduleModifyStart >= data.scheduleModifyEnd
		) {
			ctx.addIssue({
				code: "custom",
				message: "scheduleModifyStart must be before scheduleModifyEnd",
				path: ["scheduleModifyStart"],
			});
		}
	});

export type TUpdateSchema = z.infer<typeof ZUpdateSchema>;

export type TUpdateOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TUpdateSchema;
};

export async function updateHandler(options: TUpdateOptions) {
	const {
		id,
		name,
		start,
		end,
		visibleStart,
		visibleEnd,
		scheduleSignupStart,
		scheduleSignupEnd,
		scheduleModifyStart,
		scheduleModifyEnd,
	} = options.input;

	const existing = await prisma.period.findUnique({ where: { id } });

	if (!existing) {
		return { period: undefined };
	}

	const nextStart = start ?? existing.start;
	const nextEnd = end ?? existing.end;
	const nextVisibleStart =
		visibleStart === undefined ? existing.visibleStart : visibleStart;
	const nextVisibleEnd =
		visibleEnd === undefined ? existing.visibleEnd : visibleEnd;
	const nextScheduleSignupStart =
		scheduleSignupStart === undefined
			? existing.scheduleSignupStart
			: scheduleSignupStart;
	const nextScheduleSignupEnd =
		scheduleSignupEnd === undefined
			? existing.scheduleSignupEnd
			: scheduleSignupEnd;
	const nextScheduleModifyStart =
		scheduleModifyStart === undefined
			? existing.scheduleModifyStart
			: scheduleModifyStart;
	const nextScheduleModifyEnd =
		scheduleModifyEnd === undefined
			? existing.scheduleModifyEnd
			: scheduleModifyEnd;

	if (nextStart >= nextEnd) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Start must be before end",
		});
	}

	if (
		nextVisibleStart &&
		nextVisibleEnd &&
		nextVisibleStart >= nextVisibleEnd
	) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Visible start must be before visible end",
		});
	}

	if (
		nextScheduleSignupStart &&
		nextScheduleSignupEnd &&
		nextScheduleSignupStart >= nextScheduleSignupEnd
	) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Schedule signup start must be before schedule signup end",
		});
	}

	if (
		nextScheduleModifyStart &&
		nextScheduleModifyEnd &&
		nextScheduleModifyStart >= nextScheduleModifyEnd
	) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Schedule modify start must be before schedule modify end",
		});
	}

	return await prisma.$transaction(async (tx) => {
		const updated = await tx.period.update({
			where: { id },
			data: {
				...(name !== undefined && { name }),
				start: nextStart,
				end: nextEnd,
				visibleStart: nextVisibleStart,
				visibleEnd: nextVisibleEnd,
				scheduleSignupStart: nextScheduleSignupStart,
				scheduleSignupEnd: nextScheduleSignupEnd,
				scheduleModifyStart: nextScheduleModifyStart,
				scheduleModifyEnd: nextScheduleModifyEnd,
			},
		});

		if (!updated) {
			throw new TRPCError({
				code: "INTERNAL_SERVER_ERROR",
				message: "Failed to update period",
			});
		}

		if (
			updated.start.getTime() !== existing.start.getTime() ||
			updated.end.getTime() !== existing.end.getTime()
		) {
			// Re-generate occurrences for all schedules in this period
			await generatePeriodShiftOccurrences(tx, updated.id);
		}

		return { period: updated };
	});
}
