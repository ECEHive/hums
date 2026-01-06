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

	// Check if suspension exists
	const existing = await prisma.suspension.findUnique({
		where: { id },
	});

	if (!existing) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Suspension not found",
		});
	}

	// Validate dates if both are provided
	const finalStartDate = startDate ?? existing.startDate;
	const finalEndDate = endDate ?? existing.endDate;

	if (finalEndDate <= finalStartDate) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "End date must be after start date",
		});
	}

	const suspension = await updateSuspension(prisma, {
		id,
		startDate,
		endDate,
		internalNotes,
		externalNotes,
	});

	return suspension;
}
