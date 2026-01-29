import { assertCanAccessPeriod, getUserWithRoles } from "@ecehive/features";
import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZRevokeExcuseSchema = z.object({
	attendanceId: z.number().min(1),
});

export type TRevokeExcuseSchema = z.infer<typeof ZRevokeExcuseSchema>;

export type TRevokeExcuseOptions = {
	ctx: TPermissionProtectedProcedureContext;
	input: TRevokeExcuseSchema;
};

/**
 * Revokes an excuse that was previously granted for an attendance record.
 * The attendance will revert to counting based on its actual status.
 */
export async function revokeExcuseHandler(options: TRevokeExcuseOptions) {
	const { attendanceId } = options.input;
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

	// Check if it's actually excused
	if (!attendance.isExcused) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "This attendance is not currently excused",
		});
	}

	// Update the attendance record
	// Clear excuse info and review info so it goes back to pending
	const updatedAttendance = await prisma.shiftAttendance.update({
		where: { id: attendanceId },
		data: {
			isExcused: false,
			excuseNotes: null,
			reviewedAt: null,
			reviewedById: null,
		},
		include: {
			user: {
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
		},
	};
}
