import { updateSuspension } from "@ecehive/features";
import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZUpdateSchema = z.object({
	id: z.number(),
	startDate: z.date().optional(),
	endDate: z.date().optional(),
	internalNotes: z.string().optional().nullable(),
	externalNotes: z.string().optional().nullable(),
});

export type TUpdateSchema = z.infer<typeof ZUpdateSchema>;

export type TUpdateOptions = {
	ctx: TPermissionProtectedProcedureContext;
	input: TUpdateSchema;
};

export async function updateHandler(options: TUpdateOptions) {
	const { id, startDate, endDate, internalNotes, externalNotes } =
		options.input;

	// Use a transaction to ensure atomicity and prevent race conditions
	const suspension = await prisma.$transaction(async (tx) => {
		// Fetch the latest suspension data within the transaction
		const existing = await tx.suspension.findUnique({
			where: { id },
		});

		if (!existing) {
			throw new TRPCError({
				code: "NOT_FOUND",
				message: "Suspension not found",
			});
		}

		// Validate dates using the latest data
		const finalStartDate = startDate ?? existing.startDate;
		const finalEndDate = endDate ?? existing.endDate;

		if (finalEndDate < finalStartDate) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "End date must be after start date",
			});
		}

		// Perform the update within the same transaction
		return await updateSuspension(tx, {
			id,
			startDate,
			endDate,
			internalNotes,
			externalNotes,
		});
	});

	return suspension;
}
