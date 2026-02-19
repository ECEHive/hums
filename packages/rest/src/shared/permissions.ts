import type { ApiTokenWithPermissions } from "@ecehive/features";
import { prisma } from "@ecehive/prisma";
import type { FastifyReply, FastifyRequest } from "fastify";

/**
 * Check if the current request has a specific permission.
 *
 * For API token requests, checks the token's directly-assigned permissions.
 * For Slack/user requests, checks the user's role-based permissions.
 * System users bypass all permission checks.
 */
export async function hasPermission(
	request: FastifyRequest,
	permissionName: string,
): Promise<boolean> {
	// API token auth path: check the token's directly-assigned permissions
	if (request.apiToken) {
		return hasApiTokenPermission(request.apiToken, permissionName);
	}

	// Slack/user auth path: check via user's roles
	if (request.user) {
		return hasUserPermission(request.user.id, permissionName);
	}

	return false;
}

/**
 * Guard that checks permission and sends a 403 response if denied.
 * Returns `true` if the request should be blocked (permission denied).
 */
export async function requirePermission(
	request: FastifyRequest,
	reply: FastifyReply,
	permissionName: string,
	message?: string,
): Promise<boolean> {
	const allowed = await hasPermission(request, permissionName);
	if (!allowed) {
		reply.code(403).send({
			error: "forbidden",
			message: message ?? "You do not have permission to perform this action",
		});
		return true;
	}
	return false;
}

function hasApiTokenPermission(
	apiToken: ApiTokenWithPermissions,
	permissionName: string,
): boolean {
	return apiToken.permissions.some((p) => p.name === permissionName);
}

async function hasUserPermission(
	userId: number,
	permissionName: string,
): Promise<boolean> {
	const user = await prisma.user.findUnique({
		where: { id: userId },
		include: {
			roles: {
				include: {
					permissions: {
						where: { name: permissionName },
						select: { name: true },
					},
				},
			},
		},
	});

	if (!user) return false;
	if (user.isSystemUser) return true;

	return user.roles.some((role) => role.permissions.length > 0);
}
