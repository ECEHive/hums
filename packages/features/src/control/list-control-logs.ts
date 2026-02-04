/**
 * Control Logs - List
 */

import type { Prisma } from "@ecehive/prisma";
import { prisma } from "@ecehive/prisma";

export interface ListControlLogsInput {
	controlPointId?: string;
	userId?: number;
	action?: "TURN_ON" | "TURN_OFF" | "UNLOCK" | "READ_STATE";
	success?: boolean;
	startDate?: Date;
	endDate?: Date;
	limit?: number;
	offset?: number;
	sortOrder?: "asc" | "desc";
}

/**
 * Lists control logs with filtering and pagination
 */
export async function listControlLogs(input: ListControlLogsInput) {
	const limit = input.limit ?? 25;
	const offset = input.offset ?? 0;
	const sortOrder = input.sortOrder ?? "desc";

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
			orderBy: { createdAt: sortOrder },
			take: limit,
			skip: offset,
		}),
		prisma.controlLog.count({ where }),
	]);

	return {
		logs,
		total,
		limit,
		offset,
	};
}
