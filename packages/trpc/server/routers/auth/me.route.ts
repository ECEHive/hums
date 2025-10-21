import {
	db,
	permissions,
	rolePermissions,
	roles,
	type SelectUser,
	userRoles,
} from "@ecehive/drizzle";
import { eq } from "drizzle-orm";
import z from "zod";

export const ZMeSchema = z.object({});

export type TMeSchema = z.infer<typeof ZMeSchema>;

export type TMeOptions = {
	ctx: {
		userId: number;
		user: SelectUser;
	};
	input: TMeSchema;
};

export async function meHandler(options: TMeOptions) {
	// Get roles for the user
	const rolesResult = await db
		.select({ id: roles.id, name: roles.name })
		.from(roles)
		.innerJoin(userRoles, eq(userRoles.roleId, roles.id))
		.where(eq(userRoles.userId, options.ctx.userId));

	// Get permissions for the user (permission name strings)
	const permissionsResult = await db
		.select({ name: permissions.name })
		.from(rolePermissions)
		.innerJoin(userRoles, eq(rolePermissions.roleId, userRoles.roleId))
		.innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
		.where(eq(userRoles.userId, options.ctx.userId));

	return {
		user: {
			...options.ctx.user,
			roles: rolesResult,
			// Return the permissions as names only with no duplicates
			permissions: Array.from(new Set(permissionsResult.map((p) => p.name))),
		},
	};
}
