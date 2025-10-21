import { db, periodExceptions, periods } from "@ecehive/drizzle";
import { generatePeriodShiftOccurrences } from "@ecehive/features";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
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

	return await db.transaction(async (tx) => {
		const [existing] = await tx
			.select()
			.from(periodExceptions)
			.where(eq(periodExceptions.id, id))
			.limit(1);

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
		const [period] = await tx
			.select()
			.from(periods)
			.where(eq(periods.id, existing.periodId))
			.limit(1);

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

		const updates: Partial<typeof periodExceptions.$inferInsert> = {
			updatedAt: new Date(),
		};

		if (name !== undefined) {
			updates.name = name;
		}

		if (start !== undefined) {
			updates.start = start;
		}

		if (end !== undefined) {
			updates.end = end;
		}

		const [updated] = await tx
			.update(periodExceptions)
			.set(updates)
			.where(eq(periodExceptions.id, id))
			.returning();

		if (!updated) {
			return { periodException: undefined };
		}

		// Regenerate shift occurrences for the period to apply changes
		await generatePeriodShiftOccurrences(tx, updated.periodId);

		return { periodException: updated };
	});
}
