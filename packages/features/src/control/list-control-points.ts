import type { Prisma } from "@ecehive/prisma";
import { prisma } from "@ecehive/prisma";

export type ListControlPointsOptions = {
	search?: string;
	providerId?: number;
	controlClass?: "SWITCH" | "DOOR";
	isActive?: boolean;
	canControlOnline?: boolean;
	limit?: number;
	offset?: number;
	sortBy?: "name" | "location" | "createdAt";
	sortOrder?: "asc" | "desc";
};

/**
 * Lists control points with optional filtering, pagination, and sorting.
 *
 * @param options - Filter, pagination, and sorting options
 * @returns Object containing control points array, total count, and pagination info
 */
export async function listControlPoints(
	options: ListControlPointsOptions = {},
) {
	const {
		search,
		providerId,
		controlClass,
		isActive,
		canControlOnline,
		limit = 25,
		offset = 0,
		sortBy = "name",
		sortOrder = "asc",
	} = options;

	const where: Prisma.ControlPointWhereInput = {};

	if (search) {
		where.OR = [
			{ name: { contains: search, mode: "insensitive" } },
			{ description: { contains: search, mode: "insensitive" } },
			{ location: { contains: search, mode: "insensitive" } },
		];
	}

	if (providerId !== undefined) {
		where.providerId = providerId;
	}

	if (controlClass) {
		where.controlClass = controlClass;
	}

	if (isActive !== undefined) {
		where.isActive = isActive;
	}

	if (canControlOnline !== undefined) {
		where.canControlOnline = canControlOnline;
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
			orderBy: { [sortBy]: sortOrder },
			take: limit,
			skip: offset,
		}),
		prisma.controlPoint.count({ where }),
	]);

	return {
		points,
		total,
		limit,
		offset,
		hasMore: offset + limit < total,
	};
}

export type ControlPointListItem = Awaited<
	ReturnType<typeof listControlPoints>
>["points"][number];
