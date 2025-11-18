import type { Role } from "@ecehive/prisma";
import { Prisma, prisma } from "@ecehive/prisma";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

const ListUsersQuerySchema = z.object({
	search: z.string().trim().min(1).optional(),
	skip: z.coerce.number().int().min(0).default(0),
	take: z.coerce.number().int().min(1).max(200).default(50),
});

const UsernameParamsSchema = z.object({
	username: z.string().trim().min(1),
});

const UpsertUserSchema = z.object({
	name: z.string().trim().min(1),
	email: z.string().email(),
	cardNumber: z.string().trim().min(1).optional().nullable(),
	isSystemUser: z.boolean().optional(),
	roles: z.array(z.string().trim().min(1)).optional(),
});

const ReplaceRolesSchema = z.object({
	roles: z.array(z.string().trim().min(1)),
});

const SingleRoleSchema = z.object({
	role: z.string().trim().min(1),
});

function validationError(reply: FastifyReply, error: z.ZodError) {
	return reply.code(400).send({
		error: "invalid_request",
		message: "Input validation failed",
		details: error.flatten(),
	});
}

type UserWithRoles = Prisma.UserGetPayload<{ include: { roles: true } }>;

function sanitizeMetadata(value: unknown): Prisma.JsonValue {
	try {
		return JSON.parse(
			JSON.stringify(value ?? null, (_, candidate) =>
				typeof candidate === "bigint" ? Number(candidate) : candidate,
			),
		);
	} catch {
		return null;
	}
}

async function logRestAction(
	request: FastifyRequest,
	action: string,
	data: Record<string, unknown>,
) {
	if (!request.audit) {
		return;
	}

	await request.audit.log({
		action,
		metadata: sanitizeMetadata({
			method: request.method,
			url: request.url,
			...data,
		}),
	});
}

function serializeUser(user: UserWithRoles) {
	return {
		id: user.id,
		username: user.username,
		name: user.name,
		email: user.email,
		cardNumber: user.cardNumber,
		isSystemUser: user.isSystemUser,
		roles: user.roles.map((role) => role.name).sort(),
		createdAt: user.createdAt,
		updatedAt: user.updatedAt,
	};
}

async function getUserWithRoles(
	username: string,
): Promise<UserWithRoles | null> {
	return prisma.user.findUnique({
		where: { username },
		include: { roles: true },
	});
}

async function ensureRolesExist(
	roleNames: string[],
	reply: FastifyReply,
): Promise<Role[] | undefined> {
	if (roleNames.length === 0) {
		return [];
	}

	const uniqueNames = Array.from(new Set(roleNames));
	const roles = await prisma.role.findMany({
		where: { name: { in: uniqueNames } },
	});

	if (roles.length !== uniqueNames.length) {
		const missing = uniqueNames.filter(
			(name) => !roles.find((role) => role.name === name),
		);
		reply.code(404).send({
			error: "role_not_found",
			message: `Roles not found: ${missing.join(", ")}`,
		});
		return undefined;
	}

	return roles;
}

async function respondWithFreshUser(username: string, reply: FastifyReply) {
	const refreshed = await getUserWithRoles(username);
	if (!refreshed) {
		return reply.code(500).send({
			error: "user_refresh_failed",
			message: "Unable to reload user after update",
		});
	}

	return { user: serializeUser(refreshed) };
}

export const usersRoutes: FastifyPluginAsync = async (fastify) => {
	fastify.get("/", async (request, reply) => {
		const parsed = ListUsersQuerySchema.safeParse(request.query);
		if (!parsed.success) {
			return validationError(reply, parsed.error);
		}

		const { search, skip, take } = parsed.data;
		let where: Prisma.UserWhereInput | undefined;
		if (search) {
			const insensitive = Prisma.QueryMode.insensitive;
			where = {
				OR: [
					{ username: { contains: search, mode: insensitive } },
					{ name: { contains: search, mode: insensitive } },
					{ email: { contains: search, mode: insensitive } },
				],
			};
		}

		const users: UserWithRoles[] = await prisma.user.findMany({
			where,
			orderBy: { updatedAt: "desc" },
			skip,
			take,
			include: { roles: true },
		});

		return {
			users: users.map(serializeUser),
			meta: {
				skip,
				take,
				count: users.length,
			},
		};
	});

	fastify.get("/:username", async (request, reply) => {
		const parsed = UsernameParamsSchema.safeParse(request.params);
		if (!parsed.success) {
			return validationError(reply, parsed.error);
		}

		const user = await getUserWithRoles(parsed.data.username);
		if (!user) {
			return reply.code(404).send({
				error: "user_not_found",
				message: "User not found",
			});
		}

		return { user: serializeUser(user) };
	});

	fastify.put("/:username", async (request, reply) => {
		const params = UsernameParamsSchema.safeParse(request.params);
		if (!params.success) {
			return validationError(reply, params.error);
		}

		const body = UpsertUserSchema.safeParse(request.body);
		if (!body.success) {
			return validationError(reply, body.error);
		}

		const { roles, ...userData } = body.data;

		const updateData: Prisma.UserUpdateInput = {
			name: userData.name,
			email: userData.email,
		};
		if (userData.cardNumber !== undefined) {
			updateData.cardNumber = userData.cardNumber;
		}
		if (userData.isSystemUser !== undefined) {
			updateData.isSystemUser = userData.isSystemUser;
		}

		const createData: Prisma.UserCreateInput = {
			username: params.data.username,
			name: userData.name,
			email: userData.email,
			isSystemUser: userData.isSystemUser ?? false,
		};
		if (userData.cardNumber !== undefined) {
			createData.cardNumber = userData.cardNumber;
		}

		const upserted = await prisma.user.upsert({
			where: { username: params.data.username },
			update: updateData,
			create: createData,
			include: { roles: true },
		});

		if (roles !== undefined) {
			const resolvedRoles = await ensureRolesExist(roles, reply);
			if (!resolvedRoles) {
				return;
			}

			await prisma.user.update({
				where: { id: upserted.id },
				data: {
					roles: {
						set: resolvedRoles.map((role) => ({ id: role.id })),
					},
				},
			});
		}

		await logRestAction(request, "rest.users.upsert", {
			username: params.data.username,
			body: body.data,
			userId: upserted.id,
		});

		return respondWithFreshUser(params.data.username, reply);
	});

	fastify.put("/:username/roles", async (request, reply) => {
		const params = UsernameParamsSchema.safeParse(request.params);
		if (!params.success) {
			return validationError(reply, params.error);
		}

		const body = ReplaceRolesSchema.safeParse(request.body);
		if (!body.success) {
			return validationError(reply, body.error);
		}

		const user = await getUserWithRoles(params.data.username);
		if (!user) {
			return reply.code(404).send({
				error: "user_not_found",
				message: "User not found",
			});
		}

		const roles = await ensureRolesExist(body.data.roles, reply);
		if (!roles) {
			return;
		}

		await prisma.user.update({
			where: { id: user.id },
			data: {
				roles: {
					set: roles.map((role) => ({ id: role.id })),
				},
			},
		});

		await logRestAction(request, "rest.users.roles.replace", {
			username: params.data.username,
			roles: body.data.roles,
		});

		return respondWithFreshUser(params.data.username, reply);
	});

	fastify.post("/:username/roles", async (request, reply) => {
		const params = UsernameParamsSchema.safeParse(request.params);
		if (!params.success) {
			return validationError(reply, params.error);
		}

		const body = SingleRoleSchema.safeParse(request.body);
		if (!body.success) {
			return validationError(reply, body.error);
		}

		const user = await getUserWithRoles(params.data.username);
		if (!user) {
			return reply.code(404).send({
				error: "user_not_found",
				message: "User not found",
			});
		}

		const roles = await ensureRolesExist([body.data.role], reply);
		if (!roles) {
			return;
		}

		await prisma.user.update({
			where: { id: user.id },
			data: {
				roles: {
					connect: roles.map((role) => ({ id: role.id })),
				},
			},
		});

		await logRestAction(request, "rest.users.roles.add", {
			username: params.data.username,
			role: body.data.role,
		});

		return respondWithFreshUser(params.data.username, reply);
	});

	fastify.delete("/:username/roles/:role", async (request, reply) => {
		const params = UsernameParamsSchema.extend({
			role: z.string().trim().min(1),
		}).safeParse(request.params);
		if (!params.success) {
			return validationError(reply, params.error);
		}

		const user = await getUserWithRoles(params.data.username);
		if (!user) {
			return reply.code(404).send({
				error: "user_not_found",
				message: "User not found",
			});
		}

		const roles = await ensureRolesExist([params.data.role], reply);
		if (!roles) {
			return;
		}

		await prisma.user.update({
			where: { id: user.id },
			data: {
				roles: {
					disconnect: roles.map((role) => ({ id: role.id })),
				},
			},
		});

		await logRestAction(request, "rest.users.roles.remove", {
			username: params.data.username,
			role: params.data.role,
		});

		return respondWithFreshUser(params.data.username, reply);
	});
};
