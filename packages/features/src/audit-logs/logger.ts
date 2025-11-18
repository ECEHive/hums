import type { AuditLogSource } from "@ecehive/prisma";
import { Prisma, prisma } from "@ecehive/prisma";

export type AuditLogContext = {
	userId: number;
	source: AuditLogSource;
	impersonatedById?: number | null;
	apiTokenId?: number | null;
};

export type AuditLogPayload = AuditLogContext & {
	action: string;
	metadata?: Prisma.JsonValue;
};

export async function createAuditLogEntry(payload: AuditLogPayload) {
	await prisma.auditLog.create({
		data: {
			userId: payload.userId,
			impersonatedById: payload.impersonatedById ?? null,
			apiTokenId: payload.apiTokenId ?? null,
			action: payload.action,
			metadata: payload.metadata ?? Prisma.JsonNull,
			source: payload.source,
		},
	});
}

export type AuditLogger = {
	log: (entry: {
		action: string;
		metadata?: Prisma.JsonValue;
	}) => Promise<void>;
	withContext: (overrides: Partial<AuditLogContext>) => AuditLogger;
};

export function createAuditLogger(context: AuditLogContext): AuditLogger {
	return {
		log: (entry) =>
			createAuditLogEntry({
				...context,
				action: entry.action,
				metadata: entry.metadata,
			}),
		withContext: (overrides) =>
			createAuditLogger({
				...context,
				...overrides,
			}),
	};
}
