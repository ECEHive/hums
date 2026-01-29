import { createAuditLogger } from "@ecehive/features";
import { getLogger } from "@ecehive/logger";
import type { Prisma } from "@ecehive/prisma";
import { prisma } from "@ecehive/prisma";
import {
	type inferProcedureBuilderResolverOptions,
	initTRPC,
	TRPCError,
} from "@trpc/server";
import superjson from "superjson";
import type { Context } from "./context";
import { getClientIp } from "./utils/getClientIp";

const logger = getLogger("trpc");

const t = initTRPC.context<Context>().create({
	transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

function sanitizeMetadata(value: unknown): unknown {
	try {
		return JSON.parse(
			JSON.stringify(value ?? null, (_, candidate) => {
				return typeof candidate === "bigint" ? Number(candidate) : candidate;
			}),
		);
	} catch {
		return null;
	}
}

const auditMiddleware = t.middleware(async (opts) => {
	const rawInput =
		typeof opts.getRawInput === "function"
			? await opts.getRawInput()
			: (opts as { rawInput?: unknown }).rawInput;
	const result = await opts.next();

	if (opts.type === "mutation" && opts.ctx.audit) {
		const metadataPayload = sanitizeMetadata({
			input: rawInput ?? opts.input ?? null,
		}) as Prisma.JsonValue;
		const auditMeta = (opts.meta as { auditAction?: string } | undefined)
			?.auditAction;
		await opts.ctx.audit.log({
			action: auditMeta ?? opts.path,
			metadata: metadataPayload,
		});
	}

	return result;
});

/**
 * A procedure that requires the user to be authenticated.
 */
export const protectedProcedure = t.procedure
	.use(async (opts) => {
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
			logger.error("User not found for authenticated session", {
				userId: opts.ctx.userId,
			});
			throw new TRPCError({
				code: "INTERNAL_SERVER_ERROR",
				message: "User not found",
			});
		}

		const audit = createAuditLogger({
			userId: user.id,
			impersonatedById: opts.ctx.impersonatedById ?? null,
			source: "trpc",
		});

		return opts.next({
			ctx: {
				...opts.ctx,
				user,
				audit,
			},
		});
	})
	.use(auditMiddleware);

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
								id: opts.ctx.user.id,
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
 * A procedure that requires the request to come from a registered device IP address.
 * Checks for kiosk access permission.
 */
export const kioskProtectedProcedure = t.procedure.use(async (opts) => {
	// Get the client IP address from the request
	const ip = getClientIp(opts.ctx.req);

	// Check if this IP is registered as an active device with kiosk access
	const device = await prisma.device.findFirst({
		where: {
			ipAddress: ip,
			isActive: true,
			hasKioskAccess: true,
		},
	});

	if (!device) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: `Access denied. IP address ${ip} is not registered as a device with kiosk access.`,
		});
	}

	return opts.next({
		ctx: {
			...opts.ctx,
			device,
		},
	});
});

/**
 * A procedure that requires the request to come from a registered device IP address.
 * Checks for inventory access permission.
 */
export const inventoryProtectedProcedure = t.procedure.use(async (opts) => {
	// Get the client IP address from the request
	const ip = getClientIp(opts.ctx.req);

	// Check if this IP is registered as an active device with inventory access
	const device = await prisma.device.findFirst({
		where: {
			ipAddress: ip,
			isActive: true,
			hasInventoryAccess: true,
		},
	});

	if (!device) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: `Access denied. IP address ${ip} is not registered as a device with inventory access.`,
		});
	}

	return opts.next({
		ctx: {
			...opts.ctx,
			device,
		},
	});
});

export type TInventoryProtectedProcedureContext =
	inferProcedureBuilderResolverOptions<
		typeof inventoryProtectedProcedure
	>["ctx"];

export type TKioskProtectedProcedureContext =
	inferProcedureBuilderResolverOptions<typeof kioskProtectedProcedure>["ctx"];

/**
 * A procedure that requires the request to come from a registered device with dashboard access.
 */
export const dashboardProtectedProcedure = t.procedure.use(async (opts) => {
	// Get the client IP address from the request
	const ip = getClientIp(opts.ctx.req);

	// Check if this IP is registered as an active device with dashboard access
	const device = await prisma.device.findFirst({
		where: {
			ipAddress: ip,
			isActive: true,
			hasDashboardAccess: true,
		},
	});

	if (!device) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: `Access denied. IP address ${ip} is not registered as a device with dashboard access.`,
		});
	}

	return opts.next({
		ctx: {
			...opts.ctx,
			device,
		},
	});
});

export type TDashboardProtectedProcedureContext =
	inferProcedureBuilderResolverOptions<
		typeof dashboardProtectedProcedure
	>["ctx"];
