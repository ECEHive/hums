import { assertCanAccessPeriod, getUserWithRoles } from "@ecehive/features";
import {
	type Prisma,
	prisma,
	type ShiftAttendanceStatus,
} from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZListAllUsersWithStatsSchema = z.object({
	periodId: z.number().min(1),
	search: z.string().max(100).optional(),
	limit: z.number().min(1).max(100).optional(),
	offset: z.number().min(0).optional(),
});

export type TListAllUsersWithStatsSchema = z.infer<
	typeof ZListAllUsersWithStatsSchema
>;

export type TListAllUsersWithStatsOptions = {
	ctx: TPermissionProtectedProcedureContext;
	input: TListAllUsersWithStatsSchema;
};

/**
 * Lists all users eligible for a period with their shift statistics.
 * Returns users with:
 * - Number of registered shifts
 * - Number of dropped shifts
 * - Number of makeup shifts
 */
export async function listAllUsersWithStatsHandler(
	options: TListAllUsersWithStatsOptions,
) {
	const { periodId, search, limit = 20, offset = 0 } = options.input;

	const actor = await getUserWithRoles(prisma, options.ctx.user.id);

	if (!actor) {
		throw new TRPCError({
			code: "UNAUTHORIZED",
			message: "User not found",
		});
	}

	const actorRoleIds = new Set(actor.roles.map((role) => role.id));

	const period = await prisma.period.findUnique({
		where: { id: periodId },
		include: {
			roles: {
				select: { id: true },
			},
		},
	});

	if (!period) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Period not found",
		});
	}

	assertCanAccessPeriod(period, actorRoleIds, {
		isSystemUser: options.ctx.user.isSystemUser,
	});

	const periodRoleIds = period.roles.map((role) => role.id);

	// Build user where clause
	const where: Prisma.UserWhereInput = {};
	const andFilters: Prisma.UserWhereInput[] = [];

	// Filter by period roles
	if (periodRoleIds.length > 0) {
		andFilters.push({
			roles: {
				some: {
					id: { in: periodRoleIds },
				},
			},
		});
	}

	// Search filter
	if (search?.trim()) {
		const searchTerm = search.trim();
		andFilters.push({
			OR: [
				{ name: { contains: searchTerm, mode: "insensitive" } },
				{ username: { contains: searchTerm, mode: "insensitive" } },
				{ email: { contains: searchTerm, mode: "insensitive" } },
			],
		});
	}

	if (andFilters.length > 0) {
		where.AND = andFilters;
	}

	// Get total count and users with pagination
	const [total, users] = await Promise.all([
		prisma.user.count({ where }),
		prisma.user.findMany({
			where,
			orderBy: [{ name: "asc" }, { username: "asc" }],
			skip: offset,
			take: limit,
			select: {
				id: true,
				name: true,
				username: true,
				email: true,
				roles: {
					select: { id: true, name: true },
				},
			},
		}),
	]);

	// Get shift statistics for each user
	const userIds = users.map((u) => u.id);

	// Get registered shift counts per user for this period
	const registeredShifts = await prisma.shiftSchedule.findMany({
		where: {
			shiftType: {
				periodId,
			},
			users: {
				some: {
					id: { in: userIds },
				},
			},
		},
		select: {
			id: true,
			users: {
				where: { id: { in: userIds } },
				select: { id: true },
			},
		},
	});

	// Count registered shifts per user
	const registeredCountByUser = new Map<number, number>();
	for (const schedule of registeredShifts) {
		for (const user of schedule.users) {
			const current = registeredCountByUser.get(user.id) ?? 0;
			registeredCountByUser.set(user.id, current + 1);
		}
	}

	// Get attendance stats (dropped shifts and makeup shifts)
	const attendanceStats = await prisma.shiftAttendance.groupBy({
		by: ["userId", "status"],
		where: {
			userId: { in: userIds },
			shiftOccurrence: {
				shiftSchedule: {
					shiftType: {
						periodId,
					},
				},
			},
		},
		_count: {
			id: true,
		},
	});

	// Process attendance stats by user
	const droppedByUser = new Map<number, number>();
	const makeupByUser = new Map<number, number>();

	for (const stat of attendanceStats) {
		const status = stat.status as ShiftAttendanceStatus;
		if (status === "dropped" || status === "dropped_makeup") {
			const current = droppedByUser.get(stat.userId) ?? 0;
			droppedByUser.set(stat.userId, current + stat._count.id);
		}
		if (status === "dropped_makeup") {
			// Also count as makeup
			const current = makeupByUser.get(stat.userId) ?? 0;
			makeupByUser.set(stat.userId, current + stat._count.id);
		}
	}

	// Count makeup shifts (isMakeup = true)
	const makeupStats = await prisma.shiftAttendance.groupBy({
		by: ["userId"],
		where: {
			userId: { in: userIds },
			isMakeup: true,
			shiftOccurrence: {
				shiftSchedule: {
					shiftType: {
						periodId,
					},
				},
			},
		},
		_count: {
			id: true,
		},
	});

	for (const stat of makeupStats) {
		makeupByUser.set(stat.userId, stat._count.id);
	}

	// Build final response
	const usersWithStats = users.map((user) => ({
		id: user.id,
		name: user.name,
		username: user.username,
		email: user.email,
		roles: user.roles,
		registeredShifts: registeredCountByUser.get(user.id) ?? 0,
		droppedShifts: droppedByUser.get(user.id) ?? 0,
		makeupShifts: makeupByUser.get(user.id) ?? 0,
	}));

	return {
		users: usersWithStats,
		total,
		period: {
			id: period.id,
			name: period.name,
		},
	};
}
