import type { AuditLogSource, Prisma } from "@ecehive/prisma";
import { prisma } from "@ecehive/prisma";

export type ListAuditLogsOptions = {
	limit?: number;
	page?: number;
	userId?: number;
	action?: string;
	apiTokenId?: number;
	impersonatedById?: number;
	source?: AuditLogSource;
};

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

const auditLogInclude = {
	user: {
		select: { id: true, name: true, username: true, email: true },
	},
	impersonatedBy: {
		select: { id: true, name: true, username: true, email: true },
	},
	apiToken: {
		select: { id: true, name: true, prefix: true },
	},
} satisfies Prisma.AuditLogInclude;

export type AuditLogListItem = Prisma.AuditLogGetPayload<{
	include: typeof auditLogInclude;
}>;

export type AuditLogListResult = {
	logs: AuditLogListItem[];
	page: number;
	pageSize: number;
	total: number;
	totalPages: number;
};

export async function listAuditLogs(
	options: ListAuditLogsOptions = {},
): Promise<AuditLogListResult> {
	const limit = Math.min(
		Math.max(options.limit ?? DEFAULT_LIMIT, 1),
		MAX_LIMIT,
	);
	const requestedPage = Math.max(options.page ?? 1, 1);

	const where: Prisma.AuditLogWhereInput = {};

	if (typeof options.userId === "number") {
		where.userId = options.userId;
	}

	if (typeof options.apiTokenId === "number") {
		where.apiTokenId = options.apiTokenId;
	}

	if (typeof options.impersonatedById === "number") {
		where.impersonatedById = options.impersonatedById;
	}

	if (options.action) {
		where.action = {
			contains: options.action,
			mode: "insensitive",
		};
	}

	if (options.source) {
		where.source = options.source;
	}

	const total = await prisma.auditLog.count({ where });
	const totalPages = Math.max(Math.ceil(total / limit), 1);
	const page = Math.min(requestedPage, totalPages);
	const skip = (page - 1) * limit;
	const logs = await prisma.auditLog.findMany({
		where,
		orderBy: [{ createdAt: "desc" }, { id: "desc" }],
		include: auditLogInclude,
		take: limit,
		skip,
	});

	return {
		logs,
		page,
		pageSize: limit,
		total,
		totalPages,
	};
}
