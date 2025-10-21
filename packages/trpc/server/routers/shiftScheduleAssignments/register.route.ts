import {
	db,
	periods,
	shiftScheduleAssignments,
	shiftSchedules,
	shiftTypeRoles,
	shiftTypes,
	userRoles,
} from "@ecehive/drizzle";
import { assignUserToScheduleOccurrences } from "@ecehive/features";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZRegisterSchema = z.object({
	shiftScheduleId: z.number().min(1),
});

export type TRegisterSchema = z.infer<typeof ZRegisterSchema>;

export type TRegisterOptions = {
	ctx: TPermissionProtectedProcedureContext;
	input: TRegisterSchema;
};

export async function registerHandler(options: TRegisterOptions) {
	const { shiftScheduleId } = options.input;
	const userId = options.ctx.user.id;

	return await db.transaction(async (tx) => {
		// Get the shift schedule with period info, slot count, and role requirements
		const [scheduleInfo] = await tx
			.select({
				scheduleId: shiftSchedules.id,
				slot: shiftSchedules.slot,
				shiftTypeId: shiftTypes.id,
				doRequireRoles: shiftTypes.doRequireRoles,
				periodId: periods.id,
				scheduleSignupStart: periods.scheduleSignupStart,
				scheduleSignupEnd: periods.scheduleSignupEnd,
			})
			.from(shiftSchedules)
			.innerJoin(shiftTypes, eq(shiftSchedules.shiftTypeId, shiftTypes.id))
			.innerJoin(periods, eq(shiftTypes.periodId, periods.id))
			.where(eq(shiftSchedules.id, shiftScheduleId))
			.limit(1);

		if (!scheduleInfo) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "Shift schedule not found",
			});
		}

		// Check if the shift type requires specific roles
		if (scheduleInfo.doRequireRoles !== "disabled") {
			// Get required roles for this shift type
			const requiredRoles = await tx
				.select({
					roleId: shiftTypeRoles.roleId,
				})
				.from(shiftTypeRoles)
				.where(eq(shiftTypeRoles.shiftTypeId, scheduleInfo.shiftTypeId));

			if (requiredRoles.length > 0) {
				// Get user's roles
				const userRolesData = await tx
					.select({
						roleId: userRoles.roleId,
					})
					.from(userRoles)
					.where(eq(userRoles.userId, userId));

				const userRoleIds = new Set(userRolesData.map((ur) => ur.roleId));
				const requiredRoleIds = requiredRoles.map((rr) => rr.roleId);

				// Check based on requirement type
				if (scheduleInfo.doRequireRoles === "all") {
					// User must have ALL required roles
					const hasAllRoles = requiredRoleIds.every((roleId) =>
						userRoleIds.has(roleId),
					);

					if (!hasAllRoles) {
						throw new TRPCError({
							code: "FORBIDDEN",
							message:
								"You do not have all the required roles to register for this shift",
						});
					}
				} else if (scheduleInfo.doRequireRoles === "any") {
					// User must have AT LEAST ONE required role
					const hasAnyRole = requiredRoleIds.some((roleId) =>
						userRoleIds.has(roleId),
					);

					if (!hasAnyRole) {
						throw new TRPCError({
							code: "FORBIDDEN",
							message:
								"You do not have any of the required roles to register for this shift",
						});
					}
				}
			}
		}

		// Check if registration is open
		// Note: The period's visibleStart/visibleEnd windows control when the period
		// is visible in the UI (frontend concern), while scheduleSignupStart/scheduleSignupEnd
		// control when users can actually register for shifts (backend validation).
		const now = new Date();
		const signupStart = scheduleInfo.scheduleSignupStart;
		const signupEnd = scheduleInfo.scheduleSignupEnd;

		if (!signupStart || !signupEnd) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "Registration period not configured for this period",
			});
		}

		if (now < signupStart || now > signupEnd) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "Registration is not currently open for this period",
			});
		}

		// Check if already registered
		const [existing] = await tx
			.select()
			.from(shiftScheduleAssignments)
			.where(
				and(
					eq(shiftScheduleAssignments.shiftScheduleId, shiftScheduleId),
					eq(shiftScheduleAssignments.userId, userId),
				),
			)
			.limit(1);

		if (existing) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "Already registered for this shift schedule",
			});
		}

		// Check if shift schedule has reached capacity
		// slot value represents max index (0-indexed), so capacity is slot + 1
		// Note: There's a unique constraint on (shiftScheduleId, userId) in the database
		// which will prevent duplicate registrations even in concurrent scenarios.
		// However, we still check capacity here to provide a better error message.
		const maxCapacity = scheduleInfo.slot + 1;
		const currentAssignments = await tx
			.select()
			.from(shiftScheduleAssignments)
			.where(eq(shiftScheduleAssignments.shiftScheduleId, shiftScheduleId));

		if (currentAssignments.length >= maxCapacity) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "This shift schedule has reached its maximum capacity",
			});
		}

		// Create the schedule assignment
		const [assignment] = await tx
			.insert(shiftScheduleAssignments)
			.values({
				shiftScheduleId,
				userId,
			})
			.returning();

		if (!assignment) {
			throw new TRPCError({
				code: "INTERNAL_SERVER_ERROR",
				message: "Failed to create assignment",
			});
		}

		// Assign user to all occurrences of this schedule
		await assignUserToScheduleOccurrences(tx, shiftScheduleId, userId);

		return { assignment };
	});
}
