import { assertCanAccessPeriod, getUserWithRoles } from "@ecehive/features";
import {
	type Prisma,
	prisma,
	type ShiftAttendanceStatus,
} from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

// Schema for numeric comparison filters
const numericFilterSchema = z
	.object({
		operator: z.enum(["gt", "lt", "gte", "lte", "eq"]),
		value: z.number().min(0),
	})
	.optional();

// Schema for roles filter
const rolesFilterModeSchema = z.enum([
	"has_any",
	"has_all",
	"has_none",
	"missing_any",
	"missing_all",
]);

export const ZListAllUsersWithStatsSchema = z.object({
	periodId: z.number().min(1),
	search: z.string().max(100).optional(),
	limit: z.number().min(1).max(100).optional(),
	offset: z.number().min(0).optional(),
	// Numeric filters
	registeredShiftsFilter: numericFilterSchema,
	droppedShiftsFilter: numericFilterSchema,
	makeupShiftsFilter: numericFilterSchema,
	// Roles filter
	rolesFilter: z
		.object({
			roleIds: z.array(z.number().min(1)),
			mode: rolesFilterModeSchema,
		})
		.optional(),
});

export type TListAllUsersWithStatsSchema = z.infer<
	typeof ZListAllUsersWithStatsSchema
>;

export type TListAllUsersWithStatsOptions = {
	ctx: TPermissionProtectedProcedureContext;
	input: TListAllUsersWithStatsSchema;
};

/**
 * Helper function to check if a value passes a numeric filter
 */
function passesNumericFilter(
	value: number,
	filter?: { operator: "gt" | "lt" | "gte" | "lte" | "eq"; value: number },
): boolean {
	if (!filter) return true;
	switch (filter.operator) {
		case "gt":
			return value > filter.value;
		case "lt":
			return value < filter.value;
		case "gte":
			return value >= filter.value;
		case "lte":
			return value <= filter.value;
		case "eq":
			return value === filter.value;
		default:
			return true;
	}
}

/**
 * Lists all users eligible for a period with their shift statistics.
 * Returns users with:
 * - Number of registered shifts
 * - Number of dropped shifts
 * - Number of makeup shifts
 *
 * @note When numeric filters are active, this function fetches all users
 * matching the base criteria into memory to compute stats before filtering.
 * For very large user bases, this could cause performance issues. Consider
 * implementing database-level aggregation if this becomes a bottleneck.
 */
export async function listAllUsersWithStatsHandler(
	options: TListAllUsersWithStatsOptions,
) {
	const {
		periodId,
		search,
		limit = 20,
		offset = 0,
		registeredShiftsFilter,
		droppedShiftsFilter,
		makeupShiftsFilter,
		rolesFilter,
	} = options.input;

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

	// Determine if we need to fetch all users for in-memory filtering
	// (numeric filters and some roles filter modes require post-processing)
	const hasNumericFilters =
		registeredShiftsFilter || droppedShiftsFilter || makeupShiftsFilter;

	// Roles filter modes that can be done at the database level
	const canApplyRolesFilterInDb =
		!rolesFilter ||
		rolesFilter.mode === "has_any" ||
		rolesFilter.mode === "has_all";

	const needsInMemoryFiltering = hasNumericFilters || !canApplyRolesFilterInDb;

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

	// Database-level roles filter (has_any, has_all)
	if (
		rolesFilter &&
		canApplyRolesFilterInDb &&
		rolesFilter.roleIds.length > 0
	) {
		if (rolesFilter.mode === "has_any") {
			// User has at least one of the selected roles
			andFilters.push({
				roles: {
					some: {
						id: { in: rolesFilter.roleIds },
					},
				},
			});
		} else if (rolesFilter.mode === "has_all") {
			// User has all of the selected roles
			for (const roleId of rolesFilter.roleIds) {
				andFilters.push({
					roles: {
						some: {
							id: roleId,
						},
					},
				});
			}
		}
	}

	if (andFilters.length > 0) {
		where.AND = andFilters;
	}

	// Get total count and users
	// When in-memory filtering is needed, we must fetch all users first
	const [total, users] = await Promise.all([
		prisma.user.count({ where }),
		prisma.user.findMany({
			where,
			orderBy: [{ name: "asc" }, { username: "asc" }],
			// Only apply pagination here if no in-memory filtering needed
			...(needsInMemoryFiltering ? {} : { skip: offset, take: limit }),
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
		const current = makeupByUser.get(stat.userId) ?? 0;
		makeupByUser.set(stat.userId, current + stat._count.id);
	}

	// Build users with stats (before filtering)
	const allUsersWithStats = users.map((user) => ({
		id: user.id,
		name: user.name,
		username: user.username,
		email: user.email,
		roles: user.roles,
		registeredShifts: registeredCountByUser.get(user.id) ?? 0,
		droppedShifts: droppedByUser.get(user.id) ?? 0,
		makeupShifts: makeupByUser.get(user.id) ?? 0,
	}));

	// Apply in-memory filters (numeric filters and roles filter modes that can't be done in DB)
	let filteredUsers = allUsersWithStats;
	if (needsInMemoryFiltering) {
		filteredUsers = allUsersWithStats.filter((user) => {
			// Numeric filters
			if (!passesNumericFilter(user.registeredShifts, registeredShiftsFilter)) {
				return false;
			}
			if (!passesNumericFilter(user.droppedShifts, droppedShiftsFilter)) {
				return false;
			}
			if (!passesNumericFilter(user.makeupShifts, makeupShiftsFilter)) {
				return false;
			}

			// Roles filter (modes that require in-memory filtering)
			if (
				rolesFilter &&
				rolesFilter.roleIds.length > 0 &&
				!canApplyRolesFilterInDb
			) {
				const userRoleIds = new Set(user.roles.map((r) => r.id));

				switch (rolesFilter.mode) {
					case "has_none":
						// User has none of the selected roles
						if (rolesFilter.roleIds.some((id) => userRoleIds.has(id))) {
							return false;
						}
						break;
					case "missing_any":
						// User is missing at least one of the selected roles
						if (rolesFilter.roleIds.every((id) => userRoleIds.has(id))) {
							return false;
						}
						break;
					case "missing_all":
						// User is missing all of the selected roles (same as has_none)
						if (rolesFilter.roleIds.some((id) => userRoleIds.has(id))) {
							return false;
						}
						break;
				}
			}

			return true;
		});
	}

	// Apply pagination to filtered results (only when in-memory filtering was needed)
	const filteredTotal = filteredUsers.length;
	const paginatedUsers = needsInMemoryFiltering
		? filteredUsers.slice(offset, offset + limit)
		: filteredUsers; // Already paginated by DB query

	return {
		users: paginatedUsers,
		total: needsInMemoryFiltering ? filteredTotal : total,
		period: {
			id: period.id,
			name: period.name,
		},
	};
}
