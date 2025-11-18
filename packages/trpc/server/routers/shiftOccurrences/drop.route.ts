import {
	assertCanAccessPeriod,
	computeOccurrenceStart,
	getUserWithRoles,
	lockShiftOccurrence,
} from "@ecehive/features";
import { prisma, type ShiftAttendanceStatus } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import z from "zod";
import type { TProtectedProcedureContext } from "../../trpc";
import { isWithinModifyWindow, upsertAttendanceStatus } from "./utils";

export const ZDropSchema = z.object({
	shiftOccurrenceId: z.number().min(1),
	notes: z.string().max(500).optional(),
});

export type TDropSchema = z.infer<typeof ZDropSchema>;

export type TDropOptions = {
	ctx: TProtectedProcedureContext;
	input: TDropSchema;
};

export async function dropHandler(options: TDropOptions) {
	const { shiftOccurrenceId, notes } = options.input;
	const userId = options.ctx.user.id;
	const sanitizedNotes = notes?.trim() ? notes.trim() : undefined;

	const user = await getUserWithRoles(prisma, userId);

	if (!user) {
		throw new TRPCError({
			code: "UNAUTHORIZED",
			message: "User not found",
		});
	}

	const userRoleIds = new Set(user.roles.map((role) => role.id));

	await prisma.$transaction(async (tx) => {
		const hasLock = await lockShiftOccurrence(tx, shiftOccurrenceId);

		if (hasLock === 0) {
			throw new TRPCError({
				code: "NOT_FOUND",
				message: "Shift occurrence not found",
			});
		}

		// Verify the shift occurrence exists and get related data
		const occurrence = await tx.shiftOccurrence.findUnique({
			where: { id: shiftOccurrenceId },
			include: {
				users: true,
				shiftSchedule: {
					include: {
						shiftType: {
							include: {
								period: {
									include: {
										roles: {
											select: { id: true },
										},
									},
								},
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
		const occurrenceStart = computeOccurrenceStart(
			new Date(occurrence.timestamp),
			occurrence.shiftSchedule.startTime,
		);

		if (occurrenceStart <= now) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "You cannot drop a shift that has already started or passed",
			});
		}

		// Check if we're within the schedule modify window
		const period = occurrence.shiftSchedule.shiftType.period;
		assertCanAccessPeriod(period, userRoleIds, {
			isSystemUser: options.ctx.user.isSystemUser,
		});
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
			sanitizedNotes !== undefined
				? { droppedNotes: sanitizedNotes }
				: undefined,
		);
	});

	return { success: true };
}
