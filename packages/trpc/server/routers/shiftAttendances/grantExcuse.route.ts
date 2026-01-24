import { assertCanAccessPeriod, getUserWithRoles } from "@ecehive/features";
import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZGrantExcuseSchema = z.object({
	attendanceId: z.number().min(1),
	notes: z.string().max(500).optional(),
});

export type TGrantExcuseSchema = z.infer<typeof ZGrantExcuseSchema>;

export type TGrantExcuseOptions = {
	ctx: TPermissionProtectedProcedureContext;
	input: TGrantExcuseSchema;
};

/**
 * Grants an excuse for an attendance record.
 *
 * An excused attendance counts as full credit for attendance calculations,
 * regardless of whether the user was present, absent, late, or left early.
 *
 * For dropped shifts, excusing gives the user credit as if they had attended
 * the shift they dropped (without requiring a makeup).
 */
export async function grantExcuseHandler(options: TGrantExcuseOptions) {
	const { attendanceId, notes } = options.input;
	const actorId = options.ctx.user.id;

	const actor = await getUserWithRoles(prisma, actorId);

	if (!actor) {
		throw new TRPCError({
			code: "UNAUTHORIZED",
			message: "User not found",
		});
	}

	const actorRoleIds = new Set(actor.roles.map((role) => role.id));

	// Get the attendance record with its period info
	const attendance = await prisma.shiftAttendance.findUnique({
		where: { id: attendanceId },
		include: {
			shiftOccurrence: {
				include: {
					shiftSchedule: {
						include: {
							shiftType: {
								include: {
									period: {
										include: {
											roles: { select: { id: true } },
										},
									},
								},
							},
						},
					},
				},
			},
			user: {
				select: {
					id: true,
					name: true,
					username: true,
				},
			},
		},
	});

	if (!attendance) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Attendance record not found",
		});
	}

	// Check if user has access to this period
	const period = attendance.shiftOccurrence.shiftSchedule.shiftType.period;
	assertCanAccessPeriod(period, actorRoleIds, {
		isSystemUser: options.ctx.user.isSystemUser,
	});

	// Check if already excused
	if (attendance.isExcused) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "This attendance is already excused",
		});
	}

	// Can't excuse upcoming shifts - they haven't happened yet
	if (attendance.status === "upcoming") {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Cannot excuse an upcoming shift that hasn't occurred yet",
		});
	}

	// Update the attendance record
	const updatedAttendance = await prisma.shiftAttendance.update({
		where: { id: attendanceId },
		data: {
			isExcused: true,
			excuseNotes: notes?.trim() || null,
			excusedById: actorId,
			excusedAt: new Date(),
		},
		include: {
			user: {
				select: {
					id: true,
					name: true,
					username: true,
				},
			},
			excusedBy: {
				select: {
					id: true,
					name: true,
					username: true,
				},
			},
		},
	});

	return {
		success: true,
		attendance: {
			id: updatedAttendance.id,
			user: updatedAttendance.user,
			isExcused: updatedAttendance.isExcused,
			excuseNotes: updatedAttendance.excuseNotes,
			excusedBy: updatedAttendance.excusedBy,
			excusedAt: updatedAttendance.excusedAt,
		},
	};
}
