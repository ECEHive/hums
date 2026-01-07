import { type Prisma, prisma } from "@ecehive/prisma";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZListSchema = z.object({
	limit: z.number().min(1).max(100).optional(),
	offset: z.number().min(0).optional(),
	search: z.string().min(1).max(100).optional(),
	filterRoles: z.array(z.number().min(1)).optional(),
});

export type TListSchema = z.infer<typeof ZListSchema>;

export type TListOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TListSchema;
};

export async function listHandler(options: TListOptions) {
	const { search, filterRoles, limit = 20, offset = 0 } = options.input;

	// Build where clause for filtering
	const where: Prisma.UserWhereInput = {};

	if (search) {
		where.OR = [
			{ name: { contains: search, mode: "insensitive" } },
			{ username: { contains: search, mode: "insensitive" } },
			{ email: { contains: search, mode: "insensitive" } },
			{ slackUsername: { contains: search, mode: "insensitive" } },
		];
	}

	if (filterRoles && filterRoles.length > 0) {
		where.roles = {
			some: {
				id: { in: filterRoles },
			},
		};
	}

	// Get users with their roles
	const [users, total] = await Promise.all([
		prisma.user.findMany({
			where,
			include: {
				roles: {
					orderBy: { name: "asc" },
				},
			},
			orderBy: { name: "asc" },
			skip: offset,
			take: limit,
		}),
		prisma.user.count({ where }),
	]);

	return {
		users,
		total,
	};
}
