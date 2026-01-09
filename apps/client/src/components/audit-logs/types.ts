export type AuditLogActor = {
	id: number;
	name: string | null;
	username: string | null;
	email: string | null;
};

export type AuditLogApiToken = {
	id: number;
	name: string | null;
	prefix: string;
};

export type AuditLogFilterUser = {
	id: number;
	name: string;
	username: string;
	email: string | null;
};

export type AuditLogFilterApiToken = {
	id: number;
	name: string | null;
	prefix: string;
};

export type AuditLogRow = {
	id: number;
	action: string;
	source: "trpc" | "rest" | "kiosk" | "slack";
	metadata: unknown;
	createdAt: string | Date;
	userId: number | null;
	impersonatedById: number | null;
	apiTokenId: number | null;
	user: AuditLogActor | null;
	impersonatedBy: AuditLogActor | null;
	apiToken: AuditLogApiToken | null;
};
