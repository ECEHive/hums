import type { Prisma } from "@ecehive/prisma";

export interface CreateSuspensionParams {
	userId: number;
	startDate: Date;
	endDate: Date;
	internalNotes?: string | null;
	externalNotes?: string | null;
	createdById?: number | null;
}

export interface UpdateSuspensionParams {
	id: number;
	startDate?: Date;
	endDate?: Date;
	internalNotes?: string | null;
	externalNotes?: string | null;
}

/**
 * Create a new suspension for a user
 */
export async function createSuspension(
	tx: Prisma.TransactionClient,
	params: CreateSuspensionParams,
) {
	const suspension = await tx.suspension.create({
		data: {
			userId: params.userId,
			startDate: params.startDate,
			endDate: params.endDate,
			internalNotes: params.internalNotes,
			externalNotes: params.externalNotes,
			createdById: params.createdById,
		},
		include: {
			user: {
				select: {
					id: true,
					name: true,
					username: true,
					email: true,
				},
			},
			createdBy: {
				select: {
					id: true,
					name: true,
					username: true,
				},
			},
		},
	});

	return suspension;
}

/**
 * Update an existing suspension
 * Note: Suspensions should never be deleted, only updated
 */
export async function updateSuspension(
	tx: Prisma.TransactionClient,
	params: UpdateSuspensionParams,
) {
	const suspension = await tx.suspension.update({
		where: { id: params.id },
		data: {
			startDate: params.startDate,
			endDate: params.endDate,
			internalNotes: params.internalNotes,
			externalNotes: params.externalNotes,
		},
		include: {
			user: {
				select: {
					id: true,
					name: true,
					username: true,
					email: true,
				},
			},
			createdBy: {
				select: {
					id: true,
					name: true,
					username: true,
				},
			},
		},
	});

	return suspension;
}

/**
 * Get a suspension by ID
 */
export async function getSuspension(tx: Prisma.TransactionClient, id: number) {
	const suspension = await tx.suspension.findUnique({
		where: { id },
		include: {
			user: {
				select: {
					id: true,
					name: true,
					username: true,
					email: true,
				},
			},
			createdBy: {
				select: {
					id: true,
					name: true,
					username: true,
				},
			},
		},
	});

	return suspension;
}

/**
 * List suspensions with optional filters
 */
export interface ListSuspensionsParams {
	userId?: number;
	active?: boolean;
	search?: string;
	offset?: number;
	limit?: number;
}

export async function listSuspensions(
	tx: Prisma.TransactionClient,
	params: ListSuspensionsParams = {},
) {
	const { userId, active, search, offset = 0, limit = 50 } = params;
	const now = new Date();

	const where: Prisma.SuspensionWhereInput = {};

	if (userId !== undefined) {
		where.userId = userId;
	}

	if (active !== undefined) {
		if (active) {
			// Active suspensions: startDate <= now && endDate > now
			where.startDate = { lte: now };
			where.endDate = { gt: now };
		} else {
			// Inactive suspensions: endDate <= now OR startDate > now
			where.OR = [{ endDate: { lte: now } }, { startDate: { gt: now } }];
		}
	}

	if (search) {
		where.OR = [
			{ user: { name: { contains: search, mode: "insensitive" } } },
			{ user: { username: { contains: search, mode: "insensitive" } } },
			{ user: { email: { contains: search, mode: "insensitive" } } },
			{ internalNotes: { contains: search, mode: "insensitive" } },
			{ externalNotes: { contains: search, mode: "insensitive" } },
		];
	}

	const [suspensions, total] = await Promise.all([
		tx.suspension.findMany({
			where,
			include: {
				user: {
					select: {
						id: true,
						name: true,
						username: true,
						email: true,
					},
				},
				createdBy: {
					select: {
						id: true,
						name: true,
						username: true,
					},
				},
			},
			orderBy: [{ startDate: "desc" }, { id: "desc" }],
			skip: offset,
			take: limit,
		}),
		tx.suspension.count({ where }),
	]);

	return { suspensions, total };
}

/**
 * Get suspensions for a specific user
 */
export async function getUserSuspensions(
	tx: Prisma.TransactionClient,
	userId: number,
) {
	const suspensions = await tx.suspension.findMany({
		where: { userId },
		include: {
			createdBy: {
				select: {
					id: true,
					name: true,
					username: true,
				},
			},
		},
		orderBy: [{ startDate: "desc" }, { id: "desc" }],
	});

	return suspensions;
}
