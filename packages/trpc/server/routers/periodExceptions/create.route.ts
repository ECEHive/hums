import { generatePeriodShiftOccurrences } from "@ecehive/features";
import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZCreateSchema = z
	.object({
		periodId: z.number().min(1),
		name: z.string().min(1).max(100),
		start: z.date(),
		end: z.date(),
	})
	.superRefine((data, ctx) => {
		// Start must be before end
		if (data.start >= data.end) {
			ctx.addIssue({
				code: "custom",
				message: "start must be before end",
				path: ["start"],
			});
		}
	});

export type TCreateSchema = z.infer<typeof ZCreateSchema>;

export type TCreateOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TCreateSchema;
};

export async function createHandler(options: TCreateOptions) {
	const { periodId, name, start, end } = options.input;

	return await prisma.$transaction(async (tx) => {
		// Verify the period exists
		const period = await tx.period.findUnique({
			where: { id: periodId },
		});

		if (!period) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "Period not found",
			});
		}

		// Verify exception dates fall within period bounds
		if (start < period.start || end > period.end) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "Exception dates must fall within the period bounds",
			});
		}

		const periodException = await tx.periodException.create({
			data: {
				periodId,
				name,
				start,
				end,
			},
		});

		if (!periodException) {
			return { periodException: undefined };
		}

		// Regenerate all shift occurrences for the period to apply the exception
		await generatePeriodShiftOccurrences(tx, periodId);

		return { periodException };
	});
}
