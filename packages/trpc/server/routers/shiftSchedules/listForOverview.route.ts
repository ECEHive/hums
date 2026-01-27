import {
	assertCanAccessPeriod,
	getPeriodById,
	getShiftSchedulesForListing,
	getUserWithRoles,
} from "@ecehive/features";
import { type Prisma, prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZListForOverviewSchema = z.object({
	periodId: z.number().min(1),
	dayOfWeek: z.number().min(0).max(6).optional(),
});

export type TListForOverviewSchema = z.infer<typeof ZListForOverviewSchema>;

export type TListForOverviewOptions = {
	ctx: TPermissionProtectedProcedureContext;
	input: TListForOverviewSchema;
};

/**
 * List shift schedules with full user information for admin overview.
 * This is used for the admin schedule overview page to view all schedules
 * and who is registered for each slot.
 */
export async function listForOverviewHandler(options: TListForOverviewOptions) {
	const { periodId, dayOfWeek } = options.input;

	// Get period to check access
	const period = await getPeriodById(prisma, periodId);

	if (!period) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Period not found",
		});
	}

	// Get user's roles to check period access
	const user = await getUserWithRoles(prisma, options.ctx.user.id);

	if (!user) {
		throw new TRPCError({
			code: "UNAUTHORIZED",
			message: "User not found",
		});
	}

	const userRoleIds = new Set(user.roles.map((r) => r.id));
	assertCanAccessPeriod(period, userRoleIds, {
		isSystemUser: options.ctx.user.isSystemUser,
	});

	// Build where clause
	const where: Prisma.ShiftScheduleWhereInput = {
		shiftType: { periodId },
	};

	if (dayOfWeek !== undefined) {
		where.dayOfWeek = dayOfWeek;
	}

	// Fetch shift schedules with related data
	const schedules = await getShiftSchedulesForListing(prisma, where);

	const schedulesWithInfo = schedules.map((schedule) => {
		const filledSlots = schedule.users.length;
		const availableSlots = schedule.slots - filledSlots;

		return {
			id: schedule.id,
			shiftTypeId: schedule.shiftTypeId,
			shiftTypeName: schedule.shiftType.name,
			shiftTypeColor: schedule.shiftType.color,
			shiftTypeLocation: schedule.shiftType.location,
			slots: schedule.slots,
			dayOfWeek: schedule.dayOfWeek,
			startTime: schedule.startTime,
			endTime: schedule.endTime,
			users: schedule.users.map((u) => ({
				id: u.id,
				name: u.name ?? "Unknown",
			})),
			filledSlots,
			availableSlots,
		};
	});

	return {
		period: {
			id: period.id,
			name: period.name,
		},
		schedules: schedulesWithInfo,
	};
}
