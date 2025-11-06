import { prisma, type User } from "@ecehive/prisma";
import z from "zod";

export const ZMeSchema = z.object({});

export type TMeSchema = z.infer<typeof ZMeSchema>;

export type TMeOptions = {
	ctx: {
		userId: number;
		user: User;
	};
	input: TMeSchema;
};

export async function meHandler(options: TMeOptions) {
	// Get user with roles and permissions in a single optimized query
	const userWithRolesAndPermissions = await prisma.user.findUnique({
		where: { id: options.ctx.userId },
		include: {
			roles: {
				select: {
					id: true,
					name: true,
					permissions: {
						select: {
							name: true,
						},
					},
				},
			},
		},
	});

	if (!userWithRolesAndPermissions) {
		return {
			user: {
				...options.ctx.user,
				roles: [],
				permissions: [],
			},
		};
	}

	// Extract unique permission names from all roles
	const permissionNames = new Set<string>();
	userWithRolesAndPermissions.roles.forEach((role) => {
		role.permissions.forEach((permission) => {
			permissionNames.add(permission.name);
		});
	});

	// Transform roles to exclude nested permissions
	const roles = userWithRolesAndPermissions.roles.map((role) => ({
		id: role.id,
		name: role.name,
	}));

	return {
		user: {
			...options.ctx.user,
			roles,
			permissions: Array.from(permissionNames),
		},
	};
}
