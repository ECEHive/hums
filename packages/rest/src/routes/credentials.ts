import { credentialPreview, hashCredential } from "@ecehive/features";
import { prisma } from "@ecehive/prisma";
import { normalizeCardNumber } from "@ecehive/user-data";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { logRestAction } from "../shared/audit";
import { requirePermission } from "../shared/permissions";
import { listResponse, successResponse } from "../shared/responses";
import {
	conflictError,
	notFoundError,
	validationError,
} from "../shared/validation";

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
			if (
				await requirePermission(
					request,
					reply,
					"credentials.list",
					"You do not have permission to list credentials",
				)
			) {
				return;
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
			if (
				await requirePermission(
					request,
					reply,
					"credentials.create",
					"You do not have permission to create credentials",
				)
			) {
				return;
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
		if (
			await requirePermission(
				request,
				reply,
				"credentials.delete",
				"You do not have permission to delete credentials",
			)
		) {
			return;
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
