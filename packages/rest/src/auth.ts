import type { AuditLogger } from "@ecehive/features";
import { createAuditLogger, verifyApiToken } from "@ecehive/features";
import type { ApiToken } from "@ecehive/prisma";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

function extractToken(request: FastifyRequest) {
	const headerToken = request.headers["x-api-key"];
	const normalizedHeader =
		typeof headerToken === "string"
			? headerToken
			: Array.isArray(headerToken)
				? headerToken[0]
				: null;
	if (normalizedHeader) {
		const trimmed = normalizedHeader.toString().trim();
		if (trimmed.length > 0) {
			return trimmed;
		}
	}

	const authHeader = request.headers.authorization;
	if (authHeader?.startsWith("Bearer ")) {
		return authHeader.slice(7).trim();
	}

	return null;
}

async function apiTokenGuard(request: FastifyRequest, reply: FastifyReply) {
	const token = extractToken(request);
	if (!token) {
		return reply.code(401).send({
			error: "missing_api_token",
			message: "Provide an API token via Authorization or x-api-key",
		});
	}

	const record = await verifyApiToken(token);
	if (!record) {
		return reply.code(401).send({
			error: "invalid_api_token",
			message: "API token is invalid or expired",
		});
	}

	if (!record.createdById) {
		return reply.code(403).send({
			error: "api_token_missing_owner",
			message: "API token must be associated with a user",
		});
	}

	request.apiToken = record;
	request.audit = createAuditLogger({
		userId: record.createdById,
		apiTokenId: record.id,
		source: "rest",
	});
}

export function registerApiTokenGuard(instance: FastifyInstance) {
	instance.addHook("onRequest", apiTokenGuard);
}

declare module "fastify" {
	interface FastifyRequest {
		apiToken?: ApiToken;
		audit?: AuditLogger;
	}
}
