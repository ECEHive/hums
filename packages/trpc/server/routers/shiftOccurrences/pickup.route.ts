import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZPickupSchema = z.object({
	shiftOccurrenceId: z.number().min(1),
});

export type TPickupSchema = z.infer<typeof ZPickupSchema>;

export type TPickupOptions = {
	ctx: TPermissionProtectedProcedureContext;
	input: TPickupSchema;
};

export async function pickupHandler(options: TPickupOptions) {
	const { shiftOccurrenceId } = options.input;
	const userId = options.ctx.userId;

	// Verify the shift occurrence exists and get related data
	const occurrence = await prisma.shiftOccurrence.findUnique({
		where: { id: shiftOccurrenceId },
		include: {
			users: true,
			shiftSchedule: {
				include: {
					shiftType: {
						include: {
							period: true,
						},
					},
				},
			},
		},
	});

	if (!occurrence) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Shift occurrence not found",
		});
	}

	// Check if we're within the schedule modify window
	const period = occurrence.shiftSchedule.shiftType.period;
	const now = new Date();
	const isModifyByStart =
		!period.scheduleModifyStart || new Date(period.scheduleModifyStart) <= now;
	const isModifyByEnd =
		!period.scheduleModifyEnd || new Date(period.scheduleModifyEnd) >= now;
	const isWithinModifyWindow = isModifyByStart && isModifyByEnd;

	if (!isWithinModifyWindow) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message:
				"Shift occurrence pickup is not currently allowed. Please check the modification window for this period.",
		});
	}

	// Check if user is already assigned
	if (occurrence.users.some((u) => u.id === userId)) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "You are already assigned to this shift occurrence",
		});
	}

	if (occurrence.users.length > 0) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "This shift occurrence already has someone assigned",
		});
	}

	// Assign user to the occurrence
	await prisma.shiftOccurrence.update({
		where: { id: shiftOccurrenceId },
		data: {
			users: {
				connect: { id: userId },
			},
		},
	});

	return { success: true };
}
