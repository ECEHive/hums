/**
 * Control Providers - List
 */

import type { Prisma } from "@ecehive/prisma";
import { prisma } from "@ecehive/prisma";

export interface ListControlProvidersInput {
	search?: string;
	isActive?: boolean;
	limit?: number;
	offset?: number;
}

/**
 * Lists control providers with filtering and pagination
 */
export async function listControlProviders(input: ListControlProvidersInput) {
	const limit = input.limit ?? 25;
	const offset = input.offset ?? 0;

	const where: Prisma.ControlProviderWhereInput = {};

	if (input.search) {
		where.name = { contains: input.search, mode: "insensitive" };
	}

	if (input.isActive !== undefined) {
		where.isActive = input.isActive;
	}

	const [providers, total] = await Promise.all([
		prisma.controlProvider.findMany({
			where,
			include: {
				_count: {
					select: { controlPoints: true },
				},
			},
			orderBy: { name: "asc" },
			take: limit,
			skip: offset,
		}),
		prisma.controlProvider.count({ where }),
	]);

	return {
		providers,
		total,
		limit,
		offset,
	};
}
