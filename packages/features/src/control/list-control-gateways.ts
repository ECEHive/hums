/**
 * Control Gateways - List
 */

import type { Prisma } from "@ecehive/prisma";
import { prisma } from "@ecehive/prisma";

export interface ListControlGatewaysInput {
	search?: string;
	isActive?: boolean;
	limit?: number;
	offset?: number;
}

/**
 * Lists control gateways with filtering and pagination
 * Access tokens are redacted to prevent exposure
 */
export async function listControlGateways(input: ListControlGatewaysInput) {
	const limit = input.limit ?? 25;
	const offset = input.offset ?? 0;

	const where: Prisma.ControlGatewayWhereInput = {};

	if (input.search) {
		where.OR = [
			{ name: { contains: input.search, mode: "insensitive" } },
			{ description: { contains: input.search, mode: "insensitive" } },
		];
	}

	if (input.isActive !== undefined) {
		where.isActive = input.isActive;
	}

	const [gateways, total] = await Promise.all([
		prisma.controlGateway.findMany({
			where,
			include: {
				_count: {
					select: { actions: true },
				},
			},
			orderBy: { name: "asc" },
			take: limit,
			skip: offset,
		}),
		prisma.controlGateway.count({ where }),
	]);

	// Redact access tokens from response
	const redactedGateways = gateways.map((gateway) => ({
		...gateway,
		accessToken: `****${gateway.accessToken.slice(-4)}`,
	}));

	return {
		gateways: redactedGateways,
		total,
		limit,
		offset,
	};
}
