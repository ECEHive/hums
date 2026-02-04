/**
 * Control Points Routes - List
 */

import type { Prisma } from "@ecehive/prisma";
import { prisma } from "@ecehive/prisma";
import { z } from "zod";

export const ZListPointsSchema = z.object({
	search: z.string().optional(),
	providerId: z.number().int().optional(),
	controlClass: z.enum(["SWITCH", "DOOR"]).optional(),
	isActive: z.boolean().optional(),
	canControlOnline: z.boolean().optional(),
	limit: z.number().int().min(1).max(100).default(25),
	offset: z.number().int().min(0).default(0),
	sortBy: z.enum(["name", "location", "createdAt"]).default("name"),
	sortOrder: z.enum(["asc", "desc"]).default("asc"),
});

export async function listPointsHandler({
	input,
}: {
	input: z.infer<typeof ZListPointsSchema>;
}) {
	const where: Prisma.ControlPointWhereInput = {};

	if (input.search) {
		where.OR = [
			{ name: { contains: input.search, mode: "insensitive" } },
			{ description: { contains: input.search, mode: "insensitive" } },
			{ location: { contains: input.search, mode: "insensitive" } },
		];
	}

	if (input.providerId !== undefined) {
		where.providerId = input.providerId;
	}

	if (input.controlClass) {
		where.controlClass = input.controlClass;
	}

	if (input.isActive !== undefined) {
		where.isActive = input.isActive;
	}

	if (input.canControlOnline !== undefined) {
		where.canControlOnline = input.canControlOnline;
	}

	const [points, total] = await Promise.all([
		prisma.controlPoint.findMany({
			where,
			include: {
				provider: {
					select: {
						id: true,
						name: true,
						providerType: true,
					},
				},
				authorizedRoles: {
					select: { id: true, name: true },
				},
				authorizedUsers: {
					select: { id: true, name: true, username: true },
				},
			},
			orderBy: { [input.sortBy]: input.sortOrder },
			take: input.limit,
			skip: input.offset,
		}),
		prisma.controlPoint.count({ where }),
	]);

	return {
		points,
		total,
		limit: input.limit,
		offset: input.offset,
	};
}
