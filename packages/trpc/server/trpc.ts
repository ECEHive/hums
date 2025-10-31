import {
	db,
	kiosks,
	permissions,
	rolePermissions,
	roles,
	userRoles,
	users,
} from "@ecehive/drizzle";
import {
	type inferProcedureBuilderResolverOptions,
	initTRPC,
	TRPCError,
} from "@trpc/server";
import { and, eq } from "drizzle-orm";
import superjson from "superjson";
import type { Context } from "./context";

const t = initTRPC.context<Context>().create({
	transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

/**
 * A procedure that requires the user to be authenticated.
 */
export const protectedProcedure = t.procedure.use(async (opts) => {
	if (!opts.ctx.userId) {
		throw new TRPCError({
			code: "UNAUTHORIZED",
			message: "Not authorized, please login",
		});
	}

	const findUserResult = await db
		.select()
		.from(users)
		.where(eq(users.id, opts.ctx.userId));
	const user = findUserResult[0];

	if (!user) {
		throw new TRPCError({
			code: "INTERNAL_SERVER_ERROR",
			message: "User not found",
		});
	}

	return opts.next({
		ctx: {
			userId: opts.ctx.userId,
			token: opts.ctx.token,
			user,
		},
	});
});

export type TProtectedProcedureContext = inferProcedureBuilderResolverOptions<
	typeof protectedProcedure
>["ctx"];

/**
 * Produce a procedure that checks for a specific permission before allowing access.
 * @param permissionName The name of the permission to check for.
 * @returns A procedure that checks for the specified permission.
 */
export const permissionProtectedProcedure = (permissionName: string) =>
	protectedProcedure.use(async (opts) => {
		// System users bypass permission checks
		if (opts.ctx.user.isSystemUser) {
			return opts.next();
		}

		// Check if the user has the required permission
		const userPermissions = await db
			.select({
				name: permissions.name,
			})
			.from(userRoles)
			.innerJoin(roles, eq(userRoles.roleId, roles.id))
			.innerJoin(rolePermissions, eq(roles.id, rolePermissions.roleId))
			.innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
			.where(
				and(
					eq(userRoles.userId, opts.ctx.userId),
					eq(permissions.name, permissionName),
				),
			);

		// If no permissions found, throw an error
		if (userPermissions.length === 0) {
			throw new TRPCError({
				code: "FORBIDDEN",
				message: "You do not have permission to perform this action",
			});
		}

		return opts.next();
	});

export type TPermissionProtectedProcedureContext =
	inferProcedureBuilderResolverOptions<
		ReturnType<typeof permissionProtectedProcedure>
	>["ctx"];

/**
 * A procedure that requires the request to come from a registered kiosk IP address.
 */
export const kioskProtectedProcedure = t.procedure.use(async (opts) => {
	// Get the client IP address from the request
	const clientIp =
		opts.ctx.req.headers["x-forwarded-for"] ||
		opts.ctx.req.headers["x-real-ip"] ||
		opts.ctx.req.socket.remoteAddress ||
		"unknown";

	const ip = Array.isArray(clientIp) ? clientIp[0] : clientIp;

	// Check if this IP is registered as an active kiosk
	const [kiosk] = await db
		.select()
		.from(kiosks)
		.where(and(eq(kiosks.ipAddress, ip), eq(kiosks.isActive, true)))
		.limit(1);

	if (!kiosk) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: `Access denied. IP address ${ip} is not registered as a kiosk.`,
		});
	}

	return opts.next({
		ctx: {
			...opts.ctx,
			kiosk,
		},
	});
});

export type TKioskProtectedProcedureContext =
	inferProcedureBuilderResolverOptions<typeof kioskProtectedProcedure>["ctx"];
