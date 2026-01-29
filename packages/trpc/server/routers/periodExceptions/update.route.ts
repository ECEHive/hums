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
	});

export type TUpdateSchema = z.infer<typeof ZUpdateSchema>;

export type TUpdateOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TUpdateSchema;
};

export async function updateHandler(options: TUpdateOptions) {
	const { id, name, start, end } = options.input;

	return await prisma.$transaction(async (tx) => {
		const existing = await tx.periodException.findUnique({
			where: { id },
		});

		if (!existing) {
			return { periodException: undefined };
		}

		const nextStart = start ?? existing.start;
		const nextEnd = end ?? existing.end;

		if (nextStart >= nextEnd) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "Start must be before end",
			});
		}

		// Verify exception dates fall within period bounds
		const period = await tx.period.findUnique({
			where: { id: existing.periodId },
		});

		if (!period) {
			throw new TRPCError({
				code: "INTERNAL_SERVER_ERROR",
				message: "Parent period not found",
			});
		}

		if (nextStart < period.start || nextEnd > period.end) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "Exception dates must fall within the period bounds",
			});
		}

		// Determine if the exception range is shrinking (which would reveal previously excepted dates)
		// If shrinking, we need to use skipPastOccurrences to avoid recreating past occurrences
		const isExceptionShrinking =
			nextStart > existing.start || nextEnd < existing.end;

		const updated = await tx.periodException.update({
			where: { id },
			data: {
				...(name !== undefined && { name }),
				...(start !== undefined && { start }),
				...(end !== undefined && { end }),
			},
		});

		if (!updated) {
			return { periodException: undefined };
		}

		// Regenerate shift occurrences for the period to apply changes
		// Use skipPastOccurrences when the exception range is shrinking to avoid
		// recreating past occurrences that were previously excepted
		await generatePeriodShiftOccurrences(tx, updated.periodId, {
			skipPastOccurrences: isExceptionShrinking,
		});

		return { periodException: updated };
	});
}
