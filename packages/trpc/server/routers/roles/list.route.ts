import type { SelectPermission } from "@ecehive/drizzle";
import {
	db,
	permissions,
	rolePermissions,
	roles,
	userRoles,
} from "@ecehive/drizzle";
import { and, count, eq, inArray, like, type SQL } from "drizzle-orm";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZListSchema = z.object({
	limit: z.number().min(1).max(100).optional(),
	offset: z.number().min(0).optional(),
	search: z.string().min(1).max(100).optional(),
});

export type TListSchema = z.infer<typeof ZListSchema>;

export type TListOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TListSchema;
};

export async function listHandler(options: TListOptions) {
	const { search, limit, offset = 0 } = options.input;

	const filters = [] as (SQL | undefined)[];

	if (search) {
		filters.push(like(roles.name, `%${search.replaceAll("%", "\\%")}%`));
	}

	// Step 1: Get paginated role IDs
	const pagedRoleIdsQuery = db
		.select({ id: roles.id })
		.from(roles)
		.where(and(...filters))
		.orderBy(roles.name)
		.offset(offset);

	if (limit) {
		pagedRoleIdsQuery.limit(limit);
	}

	const pagedRoleIdsResult = await pagedRoleIdsQuery;

	const pagedRoleIds = pagedRoleIdsResult.map((r) => r.id);

	// Step 2: Get roles and their permissions for paginated IDs
	const rolesResult =
		pagedRoleIds.length === 0
			? []
			: await db
					.select()
					.from(roles)
					.leftJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
					.leftJoin(
						permissions,
						eq(permissions.id, rolePermissions.permissionId),
					)
					.where(inArray(roles.id, pagedRoleIds))
					.orderBy(roles.name);

	const userCountsQuery = db
		.select({
			roleId: userRoles.roleId,
			userCount: count(userRoles.userId).as("userCount"),
		})
		.from(userRoles)
		.groupBy(userRoles.roleId);

	if (pagedRoleIds.length > 0) {
		userCountsQuery.where(inArray(userRoles.roleId, pagedRoleIds));
	}

	const userCountsResult = await userCountsQuery;

	const rolesMap = new Map<
		number,
		{
			id: number;
			name: string;
			permissions: SelectPermission[];
			userCount: number;
		}
	>();

	rolesResult.forEach((row) => {
		const roleId = row.roles.id;
		if (!rolesMap.has(roleId)) {
			rolesMap.set(roleId, {
				id: row.roles.id,
				name: row.roles.name,
				permissions: [],
				userCount: 0,
			});
		}
		const role = rolesMap.get(roleId);
		if (role && row.permissions) {
			role.permissions.push(row.permissions);
		}
	});

	// Attach user counts to roles
	const userCountsMap = new Map<number, number>();
	userCountsResult.forEach((row) => {
		userCountsMap.set(row.roleId, Number(row.userCount));
	});

	rolesMap.forEach((role) => {
		role.userCount = userCountsMap.get(role.id) || 0;
	});

	const [total] = await db
		.select({ count: count(roles.id) })
		.from(roles)
		.where(and(...filters));

	return {
		roles: Array.from(rolesMap.values()),
		total: total?.count ?? 0,
	};
}
