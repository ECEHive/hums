import { lockShiftOccurrences } from "@ecehive/features";
import { prisma, type ShiftAttendanceStatus } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";
import { ensureUserHasPermission } from "../../utils/permissions";
import { isWithinModifyWindow, upsertAttendanceStatus } from "./utils";

export const ZDropMakeupSchema = z
	.object({
		shiftOccurrenceId: z.number().min(1),
		makeupShiftOccurrenceId: z.number().min(1),
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
	ctx: TPermissionProtectedProcedureContext;
	input: TDropMakeupSchema;
};

export async function dropMakeupHandler(options: TDropMakeupOptions) {
	const { shiftOccurrenceId, makeupShiftOccurrenceId } = options.input;
	const userId = options.ctx.userId;
	const skipPermissionCheck = options.ctx.user.isSystemUser;

	await Promise.all([
		ensureUserHasPermission({
			userId,
			permission: "shift_occurrences.drop",
			skip: skipPermissionCheck,
		}),
		ensureUserHasPermission({
			userId,
			permission: "shift_occurrences.pickup",
			skip: skipPermissionCheck,
		}),
	]);

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
								period: true,
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
		if (dropOccurrence.timestamp <= now) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message:
					"You can only drop shifts that have not started yet. This shift is already in progress or finished.",
			});
		}

		const dropPeriod = dropOccurrence.shiftSchedule.shiftType.period;
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
								period: true,
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

		if (makeupOccurrence.timestamp <= now) {
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

		await upsertAttendanceStatus(
			tx,
			shiftOccurrenceId,
			userId,
			"dropped_makeup" as ShiftAttendanceStatus,
		);
	});

	return { success: true };
}
