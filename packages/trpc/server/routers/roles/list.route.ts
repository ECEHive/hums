import { type Prisma, prisma } from "@ecehive/prisma";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZListSchema = z.object({
	limit: z.number().min(1).max(100).optional(),
	offset: z.number().min(0).optional(),
	search: z.string().min(1).max(100).optional(),
});

export type TListSchema = z.infer<typeof ZListSchema>;

export type TListOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TListSchema;
};

export async function listHandler(options: TListOptions) {
	const { search, limit = 20, offset = 0 } = options.input;

	const where: Prisma.RoleWhereInput = search
		? { name: { contains: search, mode: "insensitive" } }
		: {};

	const [roles, total] = await Promise.all([
		prisma.role.findMany({
			where,
			include: {
				permissions: {
					orderBy: { name: "asc" },
				},
				_count: {
					select: { users: true },
				},
			},
			orderBy: { name: "asc" },
			skip: offset,
			take: limit,
		}),
		prisma.role.count({ where }),
	]);

	// Transform to include userCount
	const rolesWithCount = roles.map((role) => ({
		id: role.id,
		name: role.name,
		permissions: role.permissions,
		userCount: role._count.users,
	}));

	return {
		roles: rolesWithCount,
		total,
	};
}
