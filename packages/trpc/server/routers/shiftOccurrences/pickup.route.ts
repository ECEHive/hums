import {
	computeOccurrenceEnd,
	computeOccurrenceStart,
} from "@ecehive/features";
import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";
import { isWithinModifyWindow, upsertAttendanceStatus } from "./utils";

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
	const userId = options.ctx.user.id;

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

	const shiftType = occurrence.shiftSchedule.shiftType;
	const period = shiftType.period;
	const now = new Date();

	// Check if shift type allows self-assignment
	if (!shiftType.canSelfAssign) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "This shift does not allow self-assignment",
		});
	}

	// Check if we're within the schedule modify window
	if (!isWithinModifyWindow(period, now)) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message:
				"Shift occurrence pickup is not currently allowed. Please check the modification window for this period.",
		});
	}

	// Check if shift is in the future
	const occurrenceStart = computeOccurrenceStart(
		new Date(occurrence.timestamp),
		occurrence.shiftSchedule.startTime,
	);

	if (occurrenceStart <= now) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "You can only pick up future shifts",
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

	// Check for time conflicts with other assigned shifts
	const occurrenceEnd = computeOccurrenceEnd(
		occurrenceStart,
		occurrence.shiftSchedule.startTime,
		occurrence.shiftSchedule.endTime,
	);

	const conflictingOccurrences = await prisma.shiftOccurrence.findMany({
		where: {
			users: {
				some: { id: userId },
			},
		},
		include: {
			shiftSchedule: {
				select: {
					startTime: true,
					endTime: true,
				},
			},
		},
	});

	// Check for time overlaps
	for (const conflictOccurrence of conflictingOccurrences) {
		const conflictStart = computeOccurrenceStart(
			new Date(conflictOccurrence.timestamp),
			conflictOccurrence.shiftSchedule.startTime,
		);
		const conflictEnd = computeOccurrenceEnd(
			conflictStart,
			conflictOccurrence.shiftSchedule.startTime,
			conflictOccurrence.shiftSchedule.endTime,
		);

		// Check if time ranges overlap
		if (occurrenceStart < conflictEnd && conflictStart < occurrenceEnd) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message:
					"You already have a shift scheduled that overlaps with this time.",
			});
		}
	}

	await prisma.$transaction(async (tx) => {
		// Assign user to the occurrence
		await tx.shiftOccurrence.update({
			where: { id: shiftOccurrenceId },
			data: {
				users: {
					connect: { id: userId },
				},
			},
		});

		// Create attendance record with appropriate status
		// Since we verified the shift is in the future, use "upcoming"
		await upsertAttendanceStatus(tx, shiftOccurrenceId, userId, "upcoming");
	});

	return { success: true };
}
