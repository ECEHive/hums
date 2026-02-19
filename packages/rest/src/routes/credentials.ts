import { credentialPreview, hashCredential } from "@ecehive/features";
import type { User } from "@ecehive/prisma";
import { prisma } from "@ecehive/prisma";
import { normalizeCardNumber } from "@ecehive/user-data";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { logRestAction } from "../shared/audit";
import { listResponse, successResponse } from "../shared/responses";
import {
	conflictError,
	notFoundError,
	validationError,
} from "../shared/validation";

// ===== Helper Functions =====

/**
 * Check if a user (from Slack auth or API token) has a specific permission.
 * System users bypass all permission checks.
 */
async function hasPermission(
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

	// Check if user has the permission through any role
	return user.roles.some((role) => role.permissions.length > 0);
}

/**
 * Get user ID from request (handles both Slack and API token auth).
 */
function getUserId(request: {
	user?: User;
	apiToken?: { createdById: number | null };
}): number | null {
	if (request.user) return request.user.id;
	if (request.apiToken?.createdById) return request.apiToken.createdById;
	return null;
}

// ===== Validation Schemas =====

const UserIdParamsSchema = z.object({
	userId: z.coerce.number().int().min(1),
});

const CredentialIdParamsSchema = z.object({
	userId: z.coerce.number().int().min(1),
	credentialId: z.coerce.number().int().min(1),
});

const CreateCredentialSchema = z.object({
	value: z.string().trim().min(1, "Credential value is required"),
});

// ===== Routes =====

export const credentialsRoutes: FastifyPluginAsync = async (fastify) => {
	// GET /users/:userId/credentials — list credentials for a user
	fastify.get<{ Params: { userId: string } }>(
		"/:userId/credentials",
		async (request, reply) => {
			// Check permissions
			const requestUserId = getUserId(request);
			if (
				!requestUserId ||
				!(await hasPermission(requestUserId, "credentials.list"))
			) {
				return reply.code(403).send({
					error: "forbidden",
					message: "You do not have permission to list credentials",
				});
			}

			const params = UserIdParamsSchema.safeParse(request.params);
			if (!params.success) {
				return validationError(reply, params.error);
			}

			const { userId } = params.data;

			const user = await prisma.user.findUnique({ where: { id: userId } });
			if (!user) {
				return notFoundError(reply, `User with id ${userId} not found`);
			}

			const credentials = await prisma.credential.findMany({
				where: { userId },
				orderBy: { createdAt: "desc" },
				select: { id: true, preview: true, createdAt: true, updatedAt: true },
			});

			return listResponse(credentials);
		},
	);

	// POST /users/:userId/credentials — add a credential
	fastify.post<{ Params: { userId: string }; Body: unknown }>(
		"/:userId/credentials",
		async (request, reply) => {
			// Check permissions
			const requestUserId = getUserId(request);
			if (
				!requestUserId ||
				!(await hasPermission(requestUserId, "credentials.create"))
			) {
				return reply.code(403).send({
					error: "forbidden",
					message: "You do not have permission to create credentials",
				});
			}

			const params = UserIdParamsSchema.safeParse(request.params);
			if (!params.success) {
				return validationError(reply, params.error);
			}

			const body = CreateCredentialSchema.safeParse(request.body);
			if (!body.success) {
				return validationError(reply, body.error);
			}

			const { userId } = params.data;
			const normalized =
				normalizeCardNumber(body.data.value) ?? body.data.value.trim();
			const hash = hashCredential(normalized);
			const preview = credentialPreview(normalized);

			const user = await prisma.user.findUnique({ where: { id: userId } });
			if (!user) {
				return notFoundError(reply, `User with id ${userId} not found`);
			}

			const existing = await prisma.credential.findUnique({
				where: { hash },
			});
			if (existing) {
				return conflictError(
					reply,
					existing.userId === userId
						? "This credential is already associated with this user"
						: "This credential is already associated with another user",
				);
			}

			try {
				const credential = await prisma.credential.create({
					data: { hash, preview, userId },
				});

				await logRestAction(request, "credentials.create", {
					userId,
					credentialId: credential.id,
				});

				return successResponse({
					id: credential.id,
					preview: credential.preview,
					createdAt: credential.createdAt,
					updatedAt: credential.updatedAt,
				});
			} catch (error) {
				// Handle race condition: another request created this credential
				// between our check and create
				if (
					error instanceof Error &&
					"code" in error &&
					(error as { code: string }).code === "P2002"
				) {
					// Re-check ownership
					const nowExisting = await prisma.credential.findUnique({
						where: { hash },
					});
					return conflictError(
						reply,
						nowExisting?.userId === userId
							? "This credential is already associated with this user"
							: "This credential is already associated with another user",
					);
				}
				throw error;
			}
		},
	);

	// DELETE /users/:userId/credentials/:credentialId — remove a credential
	fastify.delete<{
		Params: { userId: string; credentialId: string };
	}>("/:userId/credentials/:credentialId", async (request, reply) => {
		// Check permissions
		const requestUserId = getUserId(request);
		if (
			!requestUserId ||
			!(await hasPermission(requestUserId, "credentials.delete"))
		) {
			return reply.code(403).send({
				error: "forbidden",
				message: "You do not have permission to delete credentials",
			});
		}

		const params = CredentialIdParamsSchema.safeParse(request.params);
		if (!params.success) {
			return validationError(reply, params.error);
		}

		const { userId, credentialId } = params.data;

		const credential = await prisma.credential.findUnique({
			where: { id: credentialId },
		});

		if (!credential || credential.userId !== userId) {
			return notFoundError(reply, "Credential not found");
		}

		await prisma.credential.delete({ where: { id: credentialId } });

		await logRestAction(request, "credentials.delete", {
			userId,
			credentialId,
		});

		return successResponse({ deleted: true });
	});
};
