/**
 * Control Provider Routes - List
 */

import type { Prisma } from "@ecehive/prisma";
import { prisma } from "@ecehive/prisma";
import { z } from "zod";

export const ZListProvidersSchema = z.object({
	search: z.string().optional(),
	isActive: z.boolean().optional(),
	limit: z.number().int().min(1).max(100).default(25),
	offset: z.number().int().min(0).default(0),
});

export async function listProvidersHandler({
	input,
}: {
	input: z.infer<typeof ZListProvidersSchema>;
}) {
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
			take: input.limit,
			skip: input.offset,
		}),
		prisma.controlProvider.count({ where }),
	]);

	return {
		providers,
		total,
		limit: input.limit,
		offset: input.offset,
	};
}
