import {
	assertCanAccessPeriod,
	computeOccurrenceEnd,
	computeOccurrenceStart,
	getUserWithRoles,
	lockShiftOccurrences,
} from "@ecehive/features";
import { prisma, type ShiftAttendanceStatus } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import z from "zod";
import type { TProtectedProcedureContext } from "../../trpc";
import { isWithinModifyWindow, upsertAttendanceStatus } from "./utils";

export const ZDropMakeupSchema = z
	.object({
		shiftOccurrenceId: z.number().min(1),
		makeupShiftOccurrenceId: z.number().min(1),
		notes: z.string().min(1, "A reason is required").max(500),
	})
	.superRefine((value, ctx) => {
		if (value.shiftOccurrenceId === value.makeupShiftOccurrenceId) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "The makeup shift must be different from the dropped shift",
				path: ["makeupShiftOccurrenceId"],
			});
		}
	});

export type TDropMakeupSchema = z.infer<typeof ZDropMakeupSchema>;

export type TDropMakeupOptions = {
	ctx: TProtectedProcedureContext;
	input: TDropMakeupSchema;
};

export async function dropMakeupHandler(options: TDropMakeupOptions) {
	const { shiftOccurrenceId, makeupShiftOccurrenceId, notes } = options.input;
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
		await lockShiftOccurrences(tx, [
			shiftOccurrenceId,
			makeupShiftOccurrenceId,
		]);

		const dropOccurrence = await tx.shiftOccurrence.findUnique({
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

		if (!dropOccurrence) {
			throw new TRPCError({
				code: "NOT_FOUND",
				message: "Shift occurrence to drop was not found",
			});
		}

		if (!dropOccurrence.users.some((u) => u.id === userId)) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "You are not assigned to this shift occurrence",
			});
		}

		const now = new Date();
		const dropOccurrenceStart = computeOccurrenceStart(
			new Date(dropOccurrence.timestamp),
			dropOccurrence.shiftSchedule.startTime,
		);

		if (dropOccurrenceStart <= now) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message:
					"You can only drop shifts that have not started yet. This shift is already in progress or finished.",
			});
		}

		const dropPeriod = dropOccurrence.shiftSchedule.shiftType.period;
		assertCanAccessPeriod(dropPeriod, userRoleIds, {
			isSystemUser: options.ctx.user.isSystemUser,
		});
		if (!isWithinModifyWindow(dropPeriod, now)) {
			throw new TRPCError({
				code: "FORBIDDEN",
				message:
					"Shift changes are not allowed right now. Please check the modification window for this period.",
			});
		}

		const makeupOccurrence = await tx.shiftOccurrence.findUnique({
			where: { id: makeupShiftOccurrenceId },
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

		if (!makeupOccurrence) {
			throw new TRPCError({
				code: "NOT_FOUND",
				message: "The makeup shift occurrence could not be found",
			});
		}

		const makeupShiftType = makeupOccurrence.shiftSchedule.shiftType;
		const makeupPeriod = makeupShiftType.period;

		if (
			makeupShiftType.periodId !==
			dropOccurrence.shiftSchedule.shiftType.periodId
		) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "You can only makeup shifts within the same period",
			});
		}

		if (!makeupShiftType.canSelfAssign) {
			throw new TRPCError({
				code: "FORBIDDEN",
				message: "This shift does not allow self-assignment",
			});
		}

		if (!isWithinModifyWindow(makeupPeriod, now)) {
			throw new TRPCError({
				code: "FORBIDDEN",
				message:
					"The selected makeup shift is outside the allowed modification window",
			});
		}

		assertCanAccessPeriod(makeupPeriod, userRoleIds, {
			isSystemUser: options.ctx.user.isSystemUser,
		});

		const makeupOccurrenceStart = computeOccurrenceStart(
			new Date(makeupOccurrence.timestamp),
			makeupOccurrence.shiftSchedule.startTime,
		);

		if (makeupOccurrenceStart <= now) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "You can only makeup into future shifts",
			});
		}

		if (makeupOccurrence.users.length > 0) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message:
					"This shift already has someone assigned. Please pick another option.",
			});
		}

		// Check for time conflicts with other assigned shifts
		// Get the makeup shift's time range
		const makeupEnd = computeOccurrenceEnd(
			makeupOccurrenceStart,
			makeupOccurrence.shiftSchedule.startTime,
			makeupOccurrence.shiftSchedule.endTime,
		);

		// Find all other shifts assigned to this user (excluding the one being dropped)
		const userOccurrences = await tx.shiftOccurrence.findMany({
			where: {
				users: {
					some: { id: userId },
				},
				NOT: {
					id: shiftOccurrenceId,
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
		for (const occurrence of userOccurrences) {
			const occStart = computeOccurrenceStart(
				new Date(occurrence.timestamp),
				occurrence.shiftSchedule.startTime,
			);
			const occEnd = computeOccurrenceEnd(
				occStart,
				occurrence.shiftSchedule.startTime,
				occurrence.shiftSchedule.endTime,
			);

			// Check if time ranges overlap
			// Two ranges overlap if: start1 < end2 AND start2 < end1
			if (makeupOccurrenceStart < occEnd && occStart < makeupEnd) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message:
						"You already have a shift scheduled that overlaps with this time. Please choose a different makeup shift.",
				});
			}
		}

		await tx.shiftOccurrence.update({
			where: { id: shiftOccurrenceId },
			data: {
				users: {
					disconnect: { id: userId },
				},
			},
		});

		await tx.shiftOccurrence.update({
			where: { id: makeupShiftOccurrenceId },
			data: {
				users: {
					connect: { id: userId },
				},
			},
		});

		// Create attendance for makeup shift with "upcoming" status since it's in the future
		await upsertAttendanceStatus(
			tx,
			makeupShiftOccurrenceId,
			userId,
			"upcoming" as ShiftAttendanceStatus,
			{ isMakeup: true },
		);

		// Mark the dropped shift with "dropped_makeup" status
		await upsertAttendanceStatus(
			tx,
			shiftOccurrenceId,
			userId,
			"dropped_makeup" as ShiftAttendanceStatus,
			sanitizedNotes !== undefined
				? { droppedNotes: sanitizedNotes }
				: undefined,
		);
	});

	return { success: true };
}
