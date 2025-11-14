import { prisma, type ShiftAttendanceStatus } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";
import { isWithinModifyWindow, upsertAttendanceStatus } from "./utils";

export const ZDropSchema = z.object({
	shiftOccurrenceId: z.number().min(1),
});

export type TDropSchema = z.infer<typeof ZDropSchema>;

export type TDropOptions = {
	ctx: TPermissionProtectedProcedureContext;
	input: TDropSchema;
};

export async function dropHandler(options: TDropOptions) {
	const { shiftOccurrenceId } = options.input;
	const userId = options.ctx.userId;

	await prisma.$transaction(async (tx) => {
		// Verify the shift occurrence exists and get related data
		const occurrence = await tx.shiftOccurrence.findUnique({
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

		// Check if user is assigned
		if (!occurrence.users.some((u) => u.id === userId)) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "You are not assigned to this shift occurrence",
			});
		}

		const now = new Date();
		if (occurrence.timestamp <= now) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "You cannot drop a shift that has already started or passed",
			});
		}

		// Check if we're within the schedule modify window
		const period = occurrence.shiftSchedule.shiftType.period;
		if (!isWithinModifyWindow(period, now)) {
			throw new TRPCError({
				code: "FORBIDDEN",
				message:
					"Shift occurrence drop is not currently allowed. Please check the modification window for this period.",
			});
		}

		await tx.shiftOccurrence.update({
			where: { id: shiftOccurrenceId },
			data: {
				users: {
					disconnect: { id: userId },
				},
			},
		});

		await upsertAttendanceStatus(
			tx,
			shiftOccurrenceId,
			userId,
			"dropped" as ShiftAttendanceStatus,
		);
	});

	return { success: true };
}
