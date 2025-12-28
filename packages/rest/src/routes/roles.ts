import { Prisma, prisma } from "@ecehive/prisma";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { logRestAction } from "../shared/audit";
import {
	bulkResponse,
	listResponse,
	successResponse,
} from "../shared/responses";
import {
	badRequestError,
	conflictError,
	notFoundError,
	validationError,
} from "../shared/validation";

// ===== Validation Schemas =====

const ListRolesQuerySchema = z.object({
	search: z.string().trim().min(1).optional(),
	skip: z.coerce.number().int().min(0).default(0),
	take: z.coerce.number().int().min(1).max(200).default(50),
	includeUsers: z
		.enum(["true", "false"])
		.default("false")
		.transform((v) => v === "true"),
});

const RoleNameParamsSchema = z.object({
	name: z.string().trim().min(1),
});

const CreateRoleSchema = z.object({
	name: z
		.string()
		.trim()
		.min(1)
		.max(100)
		.regex(
			/^[a-zA-Z0-9_-]+$/,
			"Role name must contain only letters, numbers, hyphens, and underscores",
		),
	permissions: z.array(z.string().trim().min(1)).optional().default([]),
});

const UpdateRoleSchema = z.object({
	name: z
		.string()
		.trim()
		.min(1)
		.max(100)
		.regex(
			/^[a-zA-Z0-9_-]+$/,
			"Role name must contain only letters, numbers, hyphens, and underscores",
		)
		.optional(),
	permissions: z.array(z.string().trim().min(1)).optional(),
});

const BulkCreateRolesSchema = z.object({
	roles: z
		.array(CreateRoleSchema)
		.min(1)
		.max(100)
		.refine(
			(roles) => {
				const names = roles.map((r) => r.name);
				return names.length === new Set(names).size;
			},
			{
				message: "Duplicate role names in request",
			},
		),
});

const BulkUpdateRolesSchema = z.object({
	roles: z
		.array(
			z.object({
				name: z.string().trim().min(1),
				permissions: z.array(z.string().trim().min(1)).optional(),
			}),
		)
		.min(1)
		.max(100),
});

// ===== Helper Types =====

type RoleWithRelations = Prisma.RoleGetPayload<{
	include: { permissions: true; users: true };
}>;

type SerializedRole = {
	id: number;
	name: string;
	permissions: string[];
	userCount?: number;
	users?: Array<{ id: number; username: string; name: string }>;
	createdAt: Date;
	updatedAt: Date;
};

// ===== Helper Functions =====

function serializeRole(
	role: RoleWithRelations,
	includeUsers: boolean = false,
): SerializedRole {
	const serialized: SerializedRole = {
		id: role.id,
		name: role.name,
		permissions: role.permissions.map((p) => p.name).sort(),
		userCount: role.users.length,
		createdAt: role.createdAt,
		updatedAt: role.updatedAt,
	};

	if (includeUsers) {
		serialized.users = role.users.map((u) => ({
			id: u.id,
			username: u.username,
			name: u.name,
		}));
	}

	return serialized;
}

async function ensurePermissionsExist(
	permissionNames: string[],
): Promise<{ id: number; name: string }[] | null> {
	if (permissionNames.length === 0) {
		return [];
	}

	const uniqueNames = Array.from(new Set(permissionNames));
	const permissions = await prisma.permission.findMany({
		where: { name: { in: uniqueNames } },
		select: { id: true, name: true },
	});

	if (permissions.length !== uniqueNames.length) {
		return null;
	}

	return permissions;
}

// ===== Routes =====

export const rolesRoutes: FastifyPluginAsync = async (fastify) => {
	// ===== Bulk Operations (must be registered before parametric routes) =====

	// Bulk create roles
	fastify.post("/bulk/create", async (request, reply) => {
		const parsed = BulkCreateRolesSchema.safeParse(request.body);
		if (!parsed.success) {
			return validationError(reply, parsed.error);
		}

		const created: SerializedRole[] = [];
		const failed: Array<{ item: unknown; error: string }> = [];

		for (const roleData of parsed.data.roles) {
			try {
				// Check if exists
				const existing = await prisma.role.findUnique({
					where: { name: roleData.name },
				});

				if (existing) {
					failed.push({
						item: roleData,
						error: `Role '${roleData.name}' already exists`,
					});
					continue;
				}

				// Validate permissions
				const permissions = await ensurePermissionsExist(
					roleData.permissions || [],
				);
				if (permissions === null) {
					failed.push({
						item: roleData,
						error: "One or more permissions not found",
					});
					continue;
				}

				// Create role
				const role = await prisma.role.create({
					data: {
						name: roleData.name,
						permissions: {
							connect: permissions.map((p) => ({ id: p.id })),
						},
					},
					include: { permissions: true, users: true },
				});

				created.push(serializeRole(role));
			} catch (error) {
				failed.push({
					item: roleData,
					error: error instanceof Error ? error.message : "Unknown error",
				});
			}
		}

		await logRestAction(request, "rest.roles.bulk.create", {
			createdCount: created.length,
			failedCount: failed.length,
		});

		return bulkResponse(created, [], failed);
	});

	// Bulk update roles
	fastify.post("/bulk/update", async (request, reply) => {
		const parsed = BulkUpdateRolesSchema.safeParse(request.body);
		if (!parsed.success) {
			return validationError(reply, parsed.error);
		}

		const updated: SerializedRole[] = [];
		const failed: Array<{ item: unknown; error: string }> = [];

		for (const roleData of parsed.data.roles) {
			try {
				const existing = await prisma.role.findUnique({
					where: { name: roleData.name },
				});

				if (!existing) {
					failed.push({
						item: roleData,
						error: `Role '${roleData.name}' not found`,
					});
					continue;
				}

				// Validate permissions if provided
				let permissions: { id: number; name: string }[] | null = null;
				if (roleData.permissions) {
					permissions = await ensurePermissionsExist(roleData.permissions);
					if (permissions === null) {
						failed.push({
							item: roleData,
							error: "One or more permissions not found",
						});
						continue;
					}
				}

				// Update role
				const updateData: Prisma.RoleUpdateInput = {};
				if (permissions !== null) {
					updateData.permissions = {
						set: permissions.map((p) => ({ id: p.id })),
					};
				}

				const role = await prisma.role.update({
					where: { id: existing.id },
					data: updateData,
					include: { permissions: true, users: true },
				});

				updated.push(serializeRole(role));
			} catch (error) {
				failed.push({
					item: roleData,
					error: error instanceof Error ? error.message : "Unknown error",
				});
			}
		}

		await logRestAction(request, "rest.roles.bulk.update", {
			updatedCount: updated.length,
			failedCount: failed.length,
		});

		return bulkResponse([], updated, failed);
	});

	// ===== Standard Operations =====

	// List all roles
	fastify.get("/", async (request, reply) => {
		const parsed = ListRolesQuerySchema.safeParse(request.query);
		if (!parsed.success) {
			return validationError(reply, parsed.error);
		}

		const { search, skip, take, includeUsers } = parsed.data;

		let where: Prisma.RoleWhereInput | undefined;
		if (search) {
			where = {
				name: { contains: search, mode: Prisma.QueryMode.insensitive },
			};
		}

		const [roles, total] = await Promise.all([
			prisma.role.findMany({
				where,
				orderBy: { name: "asc" },
				skip,
				take,
				include: { permissions: true, users: true },
			}),
			prisma.role.count({ where }),
		]);

		return listResponse(
			roles.map((r) => serializeRole(r, includeUsers)),
			{
				total,
				skip,
				take,
				hasMore: skip + roles.length < total,
			},
		);
	});

	// Get a specific role by name
	fastify.get("/:name", async (request, reply) => {
		const parsed = RoleNameParamsSchema.safeParse(request.params);
		if (!parsed.success) {
			return validationError(reply, parsed.error);
		}

		const role = await prisma.role.findUnique({
			where: { name: parsed.data.name },
			include: { permissions: true, users: true },
		});

		if (!role) {
			return notFoundError(reply, "Role", parsed.data.name);
		}

		return successResponse(serializeRole(role, true));
	});

	// Create a new role
	fastify.post("/", async (request, reply) => {
		const parsed = CreateRoleSchema.safeParse(request.body);
		if (!parsed.success) {
			return validationError(reply, parsed.error);
		}

		const { name, permissions: permissionNames } = parsed.data;

		// Check if role already exists
		const existing = await prisma.role.findUnique({
			where: { name },
		});

		if (existing) {
			return conflictError(reply, `Role '${name}' already exists`);
		}

		// Validate permissions
		const permissions = await ensurePermissionsExist(permissionNames);
		if (permissions === null) {
			const existing = await prisma.permission.findMany({
				where: { name: { in: permissionNames } },
				select: { name: true },
			});
			const existingNames = existing.map((p) => p.name);
			const missing = permissionNames.filter((n) => !existingNames.includes(n));
			return badRequestError(
				reply,
				`Permissions not found: ${missing.join(", ")}`,
			);
		}

		// Create role
		const role = await prisma.role.create({
			data: {
				name,
				permissions: {
					connect: permissions.map((p) => ({ id: p.id })),
				},
			},
			include: { permissions: true, users: true },
		});

		await logRestAction(request, "rest.roles.create", {
			roleId: role.id,
			roleName: role.name,
			permissions: permissionNames,
		});

		return reply.code(201).send(successResponse(serializeRole(role)));
	});

	// Update a role
	fastify.patch("/:name", async (request, reply) => {
		const params = RoleNameParamsSchema.safeParse(request.params);
		if (!params.success) {
			return validationError(reply, params.error);
		}

		const body = UpdateRoleSchema.safeParse(request.body);
		if (!body.success) {
			return validationError(reply, body.error);
		}

		// Find existing role
		const existing = await prisma.role.findUnique({
			where: { name: params.data.name },
		});

		if (!existing) {
			return notFoundError(reply, "Role", params.data.name);
		}

		const { name: newName, permissions: permissionNames } = body.data;

		// Check if new name conflicts with another role
		if (newName && newName !== params.data.name) {
			const nameConflict = await prisma.role.findUnique({
				where: { name: newName },
			});
			if (nameConflict) {
				return conflictError(reply, `Role '${newName}' already exists`);
			}
		}

		// Validate permissions if provided
		let permissions: { id: number; name: string }[] | null = null;
		if (permissionNames) {
			permissions = await ensurePermissionsExist(permissionNames);
			if (permissions === null) {
				const existing = await prisma.permission.findMany({
					where: { name: { in: permissionNames } },
					select: { name: true },
				});
				const existingNames = existing.map((p) => p.name);
				const missing = permissionNames.filter(
					(n) => !existingNames.includes(n),
				);
				return badRequestError(
					reply,
					`Permissions not found: ${missing.join(", ")}`,
				);
			}
		}

		// Update role
		const updateData: Prisma.RoleUpdateInput = {};
		if (newName) {
			updateData.name = newName;
		}
		if (permissions !== null) {
			updateData.permissions = {
				set: permissions.map((p) => ({ id: p.id })),
			};
		}

		const updated = await prisma.role.update({
			where: { id: existing.id },
			data: updateData,
			include: { permissions: true, users: true },
		});

		await logRestAction(request, "rest.roles.update", {
			roleId: updated.id,
			oldName: params.data.name,
			newName: newName || params.data.name,
			permissions: permissionNames,
		});

		return successResponse(serializeRole(updated));
	});

	// Delete a role
	fastify.delete("/:name", async (request, reply) => {
		const parsed = RoleNameParamsSchema.safeParse(request.params);
		if (!parsed.success) {
			return validationError(reply, parsed.error);
		}

		const role = await prisma.role.findUnique({
			where: { name: parsed.data.name },
			include: { users: true },
		});

		if (!role) {
			return notFoundError(reply, "Role", parsed.data.name);
		}

		// Check if role has users
		if (role.users.length > 0) {
			return badRequestError(
				reply,
				`Cannot delete role '${parsed.data.name}' because it has ${role.users.length} assigned user(s)`,
				{ userCount: role.users.length },
			);
		}

		await prisma.role.delete({
			where: { id: role.id },
		});

		await logRestAction(request, "rest.roles.delete", {
			roleId: role.id,
			roleName: role.name,
		});

		return reply.code(204).send();
	});
};
