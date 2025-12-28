import type { Prisma } from "@ecehive/prisma";
import type { FastifyRequest } from "fastify";

/**
 * Sanitizes metadata to be JSON-serializable for audit logs
 */
export function sanitizeMetadata(value: unknown): Prisma.JsonValue {
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

/**
 * Logs a REST API action to the audit log
 * @param request - The Fastify request object containing audit context
 * @param action - The action identifier (e.g., "rest.users.create")
 * @param data - Additional metadata to log with the action
 */
export async function logRestAction(
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
