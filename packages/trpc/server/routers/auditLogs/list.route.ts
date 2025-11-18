import { listAuditLogs } from "@ecehive/features";
import { z } from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

const auditLogSources = ["trpc", "rest"] as const;

export const ZListAuditLogsSchema = z.object({
	userId: z.number().int().positive().optional(),
	action: z.string().trim().min(1).optional(),
	impersonatedById: z.number().int().positive().optional(),
	apiTokenId: z.number().int().positive().optional(),
	source: z.enum(auditLogSources).optional(),
	page: z.number().int().min(1).optional(),
	limit: z.number().int().min(1).max(100).optional(),
});

export type TListAuditLogsSchema = z.infer<typeof ZListAuditLogsSchema>;

export type TListAuditLogsOptions = {
	ctx: TPermissionProtectedProcedureContext;
	input: TListAuditLogsSchema;
};

export async function listAuditLogsHandler(options: TListAuditLogsOptions) {
	const result = await listAuditLogs({
		userId: options.input.userId,
		action: options.input.action,
		impersonatedById: options.input.impersonatedById,
		apiTokenId: options.input.apiTokenId,
		source: options.input.source,
		page: options.input.page,
		limit: options.input.limit,
	});

	return result;
}
