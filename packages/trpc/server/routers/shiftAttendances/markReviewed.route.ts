import { assertCanAccessPeriod, getUserWithRoles } from "@ecehive/features";
import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZMarkReviewedSchema = z.object({
	attendanceId: z.number().min(1),
});

export type TMarkReviewedSchema = z.infer<typeof ZMarkReviewedSchema>;

export type TMarkReviewedOptions = {
	ctx: TPermissionProtectedProcedureContext;
	input: TMarkReviewedSchema;
};

/**
 * Marks an attendance issue as reviewed without excusing it.
 *
 * This transitions an issue from "pending" to "unexcused" status.
 * The issue will still count against the user's attendance record,
 * but it will be marked as having been reviewed by staff.
 *
 * Use this when a staff member has reviewed an issue and determined
 * that it should not be excused (e.g., no valid reason provided).
 */
export async function markReviewedHandler(options: TMarkReviewedOptions) {
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

	// Check if already excused - can't mark as unexcused
	if (attendance.isExcused) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message:
				"This attendance is already excused. Revoke the excuse first to mark it as unexcused.",
		});
	}

	// Can't review upcoming shifts - they haven't happened yet
	if (attendance.status === "upcoming") {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Cannot review an upcoming shift that hasn't occurred yet",
		});
	}

	// Use conditional update to handle race conditions:
	// Only update if the record hasn't been reviewed yet (reviewedAt is null)
	// This ensures the first reviewer "wins" in case of concurrent requests
	const updateResult = await prisma.shiftAttendance.updateMany({
		where: {
			id: attendanceId,
			reviewedAt: null,
			isExcused: false,
		},
		data: {
			reviewedAt: new Date(),
			reviewedById: actorId,
		},
	});

	// If no rows were updated, it means the record was already reviewed
	if (updateResult.count === 0) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "This attendance has already been reviewed",
		});
	}

	// Fetch the updated record for the response
	const updatedAttendance = await prisma.shiftAttendance.findUniqueOrThrow({
		where: { id: attendanceId },
		include: {
			user: {
				select: {
					id: true,
					name: true,
					username: true,
				},
			},
			reviewedBy: {
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
			reviewedAt: updatedAttendance.reviewedAt,
			reviewedBy: updatedAttendance.reviewedBy,
		},
	};
}
