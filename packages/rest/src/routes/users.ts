import { Prisma, prisma } from "@ecehive/prisma";
import { normalizeCardNumber } from "@ecehive/user-data";
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

const ListUsersQuerySchema = z.object({
	search: z.string().trim().min(1).optional(),
	role: z.string().trim().min(1).optional(),
	skip: z.coerce.number().int().min(0).default(0),
	take: z.coerce.number().int().min(1).max(200).default(50),
	includeRoles: z
		.enum(["true", "false"])
		.default("true")
		.transform((v) => v === "true"),
});

const UsernameParamsSchema = z.object({
	username: z.string().trim().min(1),
});

const CreateUserSchema = z.object({
	username: z
		.string()
		.trim()
		.min(1)
		.max(100)
		.regex(
			/^[a-zA-Z0-9_.-]+$/,
			"Username must contain only letters, numbers, dots, hyphens, and underscores",
		),
	name: z.string().trim().min(1).max(255),
	email: z.string().email().max(255),
	cardNumber: z.string().trim().min(1).max(50).optional().nullable(),
	isSystemUser: z.boolean().optional().default(false),
	roles: z.array(z.string().trim().min(1)).optional().default([]),
});

const UpdateUserSchema = z.object({
	name: z.string().trim().min(1).max(255).optional(),
	email: z.string().email().max(255).optional(),
	cardNumber: z.string().trim().min(1).max(50).optional().nullable(),
	roles: z.array(z.string().trim().min(1)).optional(),
});

const BulkCreateUsersSchema = z.object({
	users: z
		.array(
			z.object({
				username: z.string().trim().min(1).max(100),
				name: z.string().trim().min(1).max(255),
				email: z.string().email().max(255),
				cardNumber: z.string().trim().min(1).max(50).optional().nullable(),
				roles: z.array(z.string().trim().min(1)).optional().default([]),
			}),
		)
		.min(1)
		.max(500), // Allow up to 500 users in a single bulk request
});

const BulkUpsertUsersSchema = z.object({
	users: z
		.array(
			z.object({
				username: z.string().trim().min(1).max(100),
				name: z.string().trim().min(1).max(255).optional(),
				email: z.string().email().max(255).optional(),
				cardNumber: z.string().trim().min(1).max(50).optional().nullable(),
				roles: z.array(z.string().trim().min(1)).optional(),
			}),
		)
		.min(1)
		.max(500), // Allow up to 500 users in a single bulk request
});

const BulkRoleOperationsSchema = z.object({
	operations: z
		.array(
			z.object({
				username: z.string().trim().min(1),
				operation: z.enum(["set", "add", "remove"]),
				roles: z.array(z.string().trim().min(1)).min(1),
			}),
		)
		.min(1)
		.max(500), // Allow up to 500 operations in a single bulk request
});

const RoleOperationSchema = z.object({
	roles: z.array(z.string().trim().min(1)).min(1),
});

// ===== Helper Types =====

type UserWithRoles = Prisma.UserGetPayload<{ include: { roles: true } }>;

type SerializedUser = {
	id: number;
	username: string;
	name: string;
	email: string;
	cardNumber: string | null;
	isSystemUser: boolean;
	roles?: string[];
	createdAt: Date;
	updatedAt: Date;
};

// ===== Helper Functions =====

function serializeUser(
	user: UserWithRoles,
	includeRoles: boolean = true,
): SerializedUser {
	const serialized: SerializedUser = {
		id: user.id,
		username: user.username,
		name: user.name,
		email: user.email,
		cardNumber: user.cardNumber,
		isSystemUser: user.isSystemUser,
		createdAt: user.createdAt,
		updatedAt: user.updatedAt,
	};

	if (includeRoles) {
		serialized.roles = user.roles.map((r) => r.name).sort();
	}

	return serialized;
}

async function ensureRolesExist(
	roleNames: string[],
): Promise<Array<{ id: number; name: string }> | null> {
	if (roleNames.length === 0) {
		return [];
	}

	const uniqueNames = Array.from(new Set(roleNames));
	const roles = await prisma.role.findMany({
		where: { name: { in: uniqueNames } },
	});

	if (roles.length !== uniqueNames.length) {
		return null;
	}

	return roles;
}

// ===== Routes =====

export const usersRoutes: FastifyPluginAsync = async (fastify) => {
	// ===== Bulk Operations (must be registered before parametric routes) =====

	// Bulk upsert users (create or update)
	fastify.post("/bulk/upsert", async (request, reply) => {
		const parsed = BulkUpsertUsersSchema.safeParse(request.body);
		if (!parsed.success) {
			return validationError(reply, parsed.error);
		}

		const created: SerializedUser[] = [];
		const updated: SerializedUser[] = [];
		const failed: Array<{ item: unknown; error: string }> = [];

		for (const userData of parsed.data.users) {
			try {
				const { username, roles: roleNames, ...data } = userData;

				// Check if user exists
				const existing = await prisma.user.findUnique({
					where: { username },
				});

				const finalUserData = { ...data };

				// Validate required fields for creation
				if (!existing && (!finalUserData.name || !finalUserData.email)) {
					failed.push({
						item: userData,
						error: "Name and email are required for new users",
					});
					continue;
				}

				// Normalize card number
				let normalizedCard: string | null | undefined;
				if (finalUserData.cardNumber !== undefined) {
					if (finalUserData.cardNumber === null) {
						normalizedCard = null;
					} else {
						normalizedCard = normalizeCardNumber(finalUserData.cardNumber);
						if (!normalizedCard) {
							failed.push({
								item: userData,
								error: "Invalid card number format",
							});
							continue;
						}
					}
				}

				// Validate roles
				let roles: Array<{ id: number; name: string }> | null = null;
				if (roleNames) {
					roles = await ensureRolesExist(roleNames);
					if (roles === null) {
						failed.push({
							item: userData,
							error: "One or more roles not found",
						});
						continue;
					}
				}

				// Upsert user
				const upsertData: Prisma.UserUpsertArgs = {
					where: { username },
					update: {},
					create: {
						username,
						name: finalUserData.name as string,
						email: finalUserData.email as string,
					},
					include: { roles: true },
				};

				// Add update fields only if they exist
				if (finalUserData.name) {
					(upsertData.update as Prisma.UserUpdateInput).name =
						finalUserData.name;
				}
				if (finalUserData.email) {
					(upsertData.update as Prisma.UserUpdateInput).email =
						finalUserData.email;
				}
				if (normalizedCard !== undefined) {
					(upsertData.update as Prisma.UserUpdateInput).cardNumber =
						normalizedCard;
					upsertData.create.cardNumber = normalizedCard;
				}

				const user = await prisma.user.upsert(upsertData);

				// Fetch user with roles for serialization
				const userWithRoles = await prisma.user.findUnique({
					where: { id: user.id },
					include: { roles: true },
				});

				if (!userWithRoles) {
					failed.push({
						item: userData,
						error: "Failed to fetch user after upsert",
					});
					continue;
				}

				// Update roles if provided
				if (roles !== null) {
					await prisma.user.update({
						where: { id: user.id },
						data: {
							roles: {
								set: roles.map((r) => ({ id: r.id })),
							},
						},
					});
					// Refresh user with updated roles
					const refreshed = await prisma.user.findUnique({
						where: { id: user.id },
						include: { roles: true },
					});
					if (refreshed) {
						userWithRoles.roles = refreshed.roles;
					}
				}

				if (existing) {
					updated.push(serializeUser(userWithRoles));
				} else {
					created.push(serializeUser(userWithRoles));
				}
			} catch (error) {
				failed.push({
					item: userData,
					error: error instanceof Error ? error.message : "Unknown error",
				});
			}
		}

		await logRestAction(request, "rest.users.bulk.upsert", {
			createdCount: created.length,
			updatedCount: updated.length,
			failedCount: failed.length,
		});

		return bulkResponse(created, updated, failed);
	});

	// Bulk create users
	fastify.post("/bulk/create", async (request, reply) => {
		const parsed = BulkCreateUsersSchema.safeParse(request.body);
		if (!parsed.success) {
			return validationError(reply, parsed.error);
		}

		const created: SerializedUser[] = [];
		const failed: Array<{ item: unknown; error: string }> = [];

		for (const userData of parsed.data.users) {
			try {
				const { username, roles: roleNames, ...data } = userData;

				// Check if user already exists
				const existing = await prisma.user.findUnique({
					where: { username },
				});

				if (existing) {
					failed.push({
						item: userData,
						error: `User '${username}' already exists`,
					});
					continue;
				}

				// Normalize card number
				let normalizedCard: string | null | undefined;
				if (data.cardNumber !== undefined) {
					if (data.cardNumber === null) {
						normalizedCard = null;
					} else {
						normalizedCard = normalizeCardNumber(data.cardNumber);
						if (!normalizedCard) {
							failed.push({
								item: userData,
								error: "Invalid card number format",
							});
							continue;
						}
					}
				}

				// Validate roles
				let roles: Array<{ id: number; name: string }> | null = null;
				if (roleNames && roleNames.length > 0) {
					roles = await ensureRolesExist(roleNames);
					if (roles === null) {
						failed.push({
							item: userData,
							error: "One or more roles not found",
						});
						continue;
					}
				}

				// Create user
				const user = await prisma.user.create({
					data: {
						username,
						name: data.name,
						email: data.email,
						cardNumber: normalizedCard,
						isSystemUser: false,
						roles: roles
							? {
									connect: roles.map((r) => ({ id: r.id })),
								}
							: undefined,
					},
					include: { roles: true },
				});

				created.push(serializeUser(user));
			} catch (error) {
				failed.push({
					item: userData,
					error: error instanceof Error ? error.message : "Unknown error",
				});
			}
		}

		await logRestAction(request, "rest.users.bulk.create", {
			createdCount: created.length,
			failedCount: failed.length,
		});

		return bulkResponse(created, [], failed);
	});

	// Bulk role operations (set, add, remove)
	fastify.post("/bulk/roles", async (request, reply) => {
		const parsed = BulkRoleOperationsSchema.safeParse(request.body);
		if (!parsed.success) {
			return validationError(reply, parsed.error);
		}

		const updated: SerializedUser[] = [];
		const failed: Array<{ item: unknown; error: string }> = [];

		for (const operation of parsed.data.operations) {
			try {
				const { username, operation: op, roles: roleNames } = operation;

				// Find user
				const user = await prisma.user.findUnique({
					where: { username },
					include: { roles: true },
				});

				if (!user) {
					failed.push({
						item: operation,
						error: `User '${username}' not found`,
					});
					continue;
				}

				// Validate roles
				const roles = await ensureRolesExist(roleNames);
				if (roles === null) {
					failed.push({
						item: operation,
						error: "One or more roles not found",
					});
					continue;
				}

				// Perform operation
				let updateData: Prisma.UserUpdateInput;
				switch (op) {
					case "set":
						updateData = {
							roles: {
								set: roles.map((r) => ({ id: r.id })),
							},
						};
						break;
					case "add":
						updateData = {
							roles: {
								connect: roles.map((r) => ({ id: r.id })),
							},
						};
						break;
					case "remove":
						updateData = {
							roles: {
								disconnect: roles.map((r) => ({ id: r.id })),
							},
						};
						break;
				}

				const updatedUser = await prisma.user.update({
					where: { id: user.id },
					data: updateData,
					include: { roles: true },
				});

				updated.push(serializeUser(updatedUser));
			} catch (error) {
				failed.push({
					item: operation,
					error: error instanceof Error ? error.message : "Unknown error",
				});
			}
		}

		await logRestAction(request, "rest.users.bulk.roles", {
			updatedCount: updated.length,
			failedCount: failed.length,
		});

		return bulkResponse([], updated, failed);
	});

	// ===== Standard Operations =====

	// List all users
	fastify.get("/", async (request, reply) => {
		const parsed = ListUsersQuerySchema.safeParse(request.query);
		if (!parsed.success) {
			return validationError(reply, parsed.error);
		}

		const { search, role, skip, take, includeRoles } = parsed.data;

		let where: Prisma.UserWhereInput | undefined;
		const conditions: Prisma.UserWhereInput[] = [];

		if (search) {
			const insensitive = Prisma.QueryMode.insensitive;
			conditions.push({
				OR: [
					{ username: { contains: search, mode: insensitive } },
					{ name: { contains: search, mode: insensitive } },
					{ email: { contains: search, mode: insensitive } },
				],
			});
		}

		if (role) {
			conditions.push({
				roles: {
					some: { name: role },
				},
			});
		}

		if (conditions.length > 0) {
			where = { AND: conditions };
		}

		const [users, total] = await Promise.all([
			prisma.user.findMany({
				where,
				orderBy: { username: "asc" },
				skip,
				take,
				include: { roles: true },
			}),
			prisma.user.count({ where }),
		]);

		return listResponse(
			users.map((u) => serializeUser(u, includeRoles)),
			{
				total,
				skip,
				take,
				hasMore: skip + users.length < total,
			},
		);
	});

	// Get a specific user by username
	fastify.get("/:username", async (request, reply) => {
		const parsed = UsernameParamsSchema.safeParse(request.params);
		if (!parsed.success) {
			return validationError(reply, parsed.error);
		}

		const user = await prisma.user.findUnique({
			where: { username: parsed.data.username },
			include: { roles: true },
		});

		if (!user) {
			return notFoundError(reply, "User", parsed.data.username);
		}

		return successResponse(serializeUser(user));
	});

	// Create a new user
	fastify.post("/", async (request, reply) => {
		const parsed = CreateUserSchema.safeParse(request.body);
		if (!parsed.success) {
			return validationError(reply, parsed.error);
		}

		const { username, roles: roleNames, ...userData } = parsed.data;

		// Check if user already exists
		const existing = await prisma.user.findUnique({
			where: { username },
		});

		if (existing) {
			return conflictError(reply, `User '${username}' already exists`);
		}

		// Normalize card number
		let normalizedCard: string | null = null;
		if (userData.cardNumber !== null && userData.cardNumber !== undefined) {
			normalizedCard = normalizeCardNumber(userData.cardNumber) || null;
			if (!normalizedCard) {
				return badRequestError(reply, "Invalid card number format");
			}
		}

		// Validate roles
		const roles = await ensureRolesExist(roleNames || []);
		if (roles === null) {
			const existing = await prisma.role.findMany({
				where: { name: { in: roleNames || [] } },
				select: { name: true },
			});
			const existingNames = existing.map((r) => r.name);
			const missing = (roleNames || []).filter(
				(n) => !existingNames.includes(n),
			);
			return badRequestError(reply, `Roles not found: ${missing.join(", ")}`);
		}

		// Create user
		const user = await prisma.user.create({
			data: {
				username,
				name: userData.name,
				email: userData.email,
				cardNumber: normalizedCard,
				isSystemUser: false,
				roles: {
					connect: roles.map((r) => ({ id: r.id })),
				},
			},
			include: { roles: true },
		});

		await logRestAction(request, "rest.users.create", {
			userId: user.id,
			username: user.username,
			roles: roleNames,
		});

		return reply.code(201).send(successResponse(serializeUser(user)));
	});

	// Update a user
	fastify.patch("/:username", async (request, reply) => {
		const params = UsernameParamsSchema.safeParse(request.params);
		if (!params.success) {
			return validationError(reply, params.error);
		}

		const body = UpdateUserSchema.safeParse(request.body);
		if (!body.success) {
			return validationError(reply, body.error);
		}

		// Find existing user
		const existing = await prisma.user.findUnique({
			where: { username: params.data.username },
		});

		if (!existing) {
			return notFoundError(reply, "User", params.data.username);
		}

		const { roles: roleNames, cardNumber, ...userData } = body.data;

		// Normalize card number if provided
		let normalizedCard: string | null | undefined;
		if (cardNumber !== undefined) {
			if (cardNumber === null) {
				normalizedCard = null;
			} else {
				normalizedCard = normalizeCardNumber(cardNumber);
				if (!normalizedCard) {
					return badRequestError(reply, "Invalid card number format");
				}
			}
		}

		// Validate roles if provided
		let roles: Array<{ id: number; name: string }> | null = null;
		if (roleNames) {
			roles = await ensureRolesExist(roleNames);
			if (roles === null) {
				const existing = await prisma.role.findMany({
					where: { name: { in: roleNames } },
					select: { name: true },
				});
				const existingNames = existing.map((r) => r.name);
				const missing = roleNames.filter((n) => !existingNames.includes(n));
				return badRequestError(reply, `Roles not found: ${missing.join(", ")}`);
			}
		}

		// Update user
		const updateData: Prisma.UserUpdateInput = {
			...userData,
		};
		if (normalizedCard !== undefined) {
			updateData.cardNumber = normalizedCard;
		}
		if (roles !== null) {
			updateData.roles = {
				set: roles.map((r) => ({ id: r.id })),
			};
		}

		const updated = await prisma.user.update({
			where: { id: existing.id },
			data: updateData,
			include: { roles: true },
		});

		await logRestAction(request, "rest.users.update", {
			userId: updated.id,
			username: updated.username,
			updatedFields: Object.keys(body.data),
		});

		return successResponse(serializeUser(updated));
	});

	// Add roles to a user
	fastify.post("/:username/roles", async (request, reply) => {
		const params = UsernameParamsSchema.safeParse(request.params);
		if (!params.success) {
			return validationError(reply, params.error);
		}

		const body = RoleOperationSchema.safeParse(request.body);
		if (!body.success) {
			return validationError(reply, body.error);
		}

		const user = await prisma.user.findUnique({
			where: { username: params.data.username },
			include: { roles: true },
		});

		if (!user) {
			return notFoundError(reply, "User", params.data.username);
		}

		const roles = await ensureRolesExist(body.data.roles);
		if (roles === null) {
			const existing = await prisma.role.findMany({
				where: { name: { in: body.data.roles } },
				select: { name: true },
			});
			const existingNames = existing.map((r) => r.name);
			const missing = body.data.roles.filter((n) => !existingNames.includes(n));
			return badRequestError(reply, `Roles not found: ${missing.join(", ")}`);
		}

		const updated = await prisma.user.update({
			where: { id: user.id },
			data: {
				roles: {
					connect: roles.map((r) => ({ id: r.id })),
				},
			},
			include: { roles: true },
		});

		await logRestAction(request, "rest.users.roles.add", {
			userId: user.id,
			username: user.username,
			addedRoles: body.data.roles,
		});

		return successResponse(serializeUser(updated));
	});

	// Remove roles from a user
	fastify.delete("/:username/roles", async (request, reply) => {
		const params = UsernameParamsSchema.safeParse(request.params);
		if (!params.success) {
			return validationError(reply, params.error);
		}

		const body = RoleOperationSchema.safeParse(request.body);
		if (!body.success) {
			return validationError(reply, body.error);
		}

		const user = await prisma.user.findUnique({
			where: { username: params.data.username },
			include: { roles: true },
		});

		if (!user) {
			return notFoundError(reply, "User", params.data.username);
		}

		const roles = await ensureRolesExist(body.data.roles);
		if (roles === null) {
			const existing = await prisma.role.findMany({
				where: { name: { in: body.data.roles } },
				select: { name: true },
			});
			const existingNames = existing.map((r) => r.name);
			const missing = body.data.roles.filter((n) => !existingNames.includes(n));
			return badRequestError(reply, `Roles not found: ${missing.join(", ")}`);
		}

		const updated = await prisma.user.update({
			where: { id: user.id },
			data: {
				roles: {
					disconnect: roles.map((r) => ({ id: r.id })),
				},
			},
			include: { roles: true },
		});

		await logRestAction(request, "rest.users.roles.remove", {
			userId: user.id,
			username: user.username,
			removedRoles: body.data.roles,
		});

		return successResponse(serializeUser(updated));
	});

	// Replace all roles for a user
	fastify.put("/:username/roles", async (request, reply) => {
		const params = UsernameParamsSchema.safeParse(request.params);
		if (!params.success) {
			return validationError(reply, params.error);
		}

		const body = RoleOperationSchema.safeParse(request.body);
		if (!body.success) {
			return validationError(reply, body.error);
		}

		const user = await prisma.user.findUnique({
			where: { username: params.data.username },
			include: { roles: true },
		});

		if (!user) {
			return notFoundError(reply, "User", params.data.username);
		}

		const roles = await ensureRolesExist(body.data.roles);
		if (roles === null) {
			const existing = await prisma.role.findMany({
				where: { name: { in: body.data.roles } },
				select: { name: true },
			});
			const existingNames = existing.map((r) => r.name);
			const missing = body.data.roles.filter((n) => !existingNames.includes(n));
			return badRequestError(reply, `Roles not found: ${missing.join(", ")}`);
		}

		const updated = await prisma.user.update({
			where: { id: user.id },
			data: {
				roles: {
					set: roles.map((r) => ({ id: r.id })),
				},
			},
			include: { roles: true },
		});

		await logRestAction(request, "rest.users.roles.replace", {
			userId: user.id,
			username: user.username,
			roles: body.data.roles,
		});

		return successResponse(serializeUser(updated));
	});
};
