import type { FastifyRequest } from "fastify";
import type { Prisma } from "@ecehive/prisma";

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
