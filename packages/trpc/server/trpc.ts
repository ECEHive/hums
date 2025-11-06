import { prisma } from "@ecehive/prisma";
import {
	type inferProcedureBuilderResolverOptions,
	initTRPC,
	TRPCError,
} from "@trpc/server";
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

	const user = await prisma.user.findUnique({
		where: { id: opts.ctx.userId },
	});

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

		// Check if the user has the required permission using Prisma's implicit many-to-many
		const permission = await prisma.permission.findFirst({
			where: {
				name: permissionName,
				roles: {
					some: {
						users: {
							some: {
								id: opts.ctx.userId,
							},
						},
					},
				},
			},
		});

		// If no permission found, throw an error
		if (!permission) {
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
	const kiosk = await prisma.kiosk.findFirst({
		where: {
			ipAddress: ip,
			isActive: true,
		},
	});

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
