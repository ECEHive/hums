/**
 * Control Logs Routes - List
 */

import type { Prisma } from "@ecehive/prisma";
import { prisma } from "@ecehive/prisma";
import { z } from "zod";

export const ZListLogsSchema = z.object({
	controlPointId: z.string().uuid().optional(),
	userId: z.number().int().optional(),
	action: z.enum(["TURN_ON", "TURN_OFF", "UNLOCK", "READ_STATE"]).optional(),
	success: z.boolean().optional(),
	startDate: z.date().optional(),
	endDate: z.date().optional(),
	limit: z.number().int().min(1).max(100).default(25),
	offset: z.number().int().min(0).default(0),
	sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export async function listLogsHandler({
	input,
}: {
	input: z.infer<typeof ZListLogsSchema>;
}) {
	const where: Prisma.ControlLogWhereInput = {};

	if (input.controlPointId) {
		where.controlPointId = input.controlPointId;
	}

	if (input.userId) {
		where.userId = input.userId;
	}

	if (input.action) {
		where.action = input.action;
	}

	if (input.success !== undefined) {
		where.success = input.success;
	}

	if (input.startDate || input.endDate) {
		where.createdAt = {};
		if (input.startDate) {
			where.createdAt.gte = input.startDate;
		}
		if (input.endDate) {
			where.createdAt.lte = input.endDate;
		}
	}

	const [logs, total] = await Promise.all([
		prisma.controlLog.findMany({
			where,
			include: {
				controlPoint: {
					select: {
						id: true,
						name: true,
						location: true,
						controlClass: true,
					},
				},
				user: {
					select: {
						id: true,
						name: true,
						username: true,
						email: true,
					},
				},
			},
			orderBy: { createdAt: input.sortOrder },
			take: input.limit,
			skip: input.offset,
		}),
		prisma.controlLog.count({ where }),
	]);

	return {
		logs,
		total,
		limit: input.limit,
		offset: input.offset,
	};
}
