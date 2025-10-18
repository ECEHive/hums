import { db, roles, rolePermissions, permissions, userRoles } from "@ecehive/drizzle";
import { and, count, eq, like, type SQL } from "drizzle-orm";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";
import type { SelectPermission } from "@ecehive/drizzle";

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
	const { search, limit = 10, offset = 0 } = options.input;

	const filters = [] as (SQL | undefined)[];

	if (search) {
		filters.push(like(roles.name, `%${search.replaceAll("%", "\\%")}%`));
	}

	const rolesResult = await db
		.select()
		.from(roles)
		.leftJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
		.leftJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
		.where(and(...filters))
		.limit(limit)
		.offset(offset)
		.orderBy(roles.name);

	const userCountsResult = await db
		.select({
			roleId: userRoles.roleId,
			userCount: count(userRoles.userId).as("userCount"),
		})
		.from(userRoles)
		.groupBy(userRoles.roleId);

	const rolesMap = new Map<
		number,
		{ id: number; name: string; permissions: SelectPermission[], userCount: number }
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
	})

	// Attach user counts to roles
	const userCountsMap = new Map<number, number>();
	userCountsResult.forEach((row) => {
		userCountsMap.set(row.roleId, Number(row.userCount));
	});

	rolesMap.forEach((role) => {
		role["userCount"] = userCountsMap.get(role.id) || 0;
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
