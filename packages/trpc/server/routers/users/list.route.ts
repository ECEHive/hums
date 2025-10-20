import type { SelectRole } from "@ecehive/drizzle";
import { db, roles, userRoles, users } from "@ecehive/drizzle";
import { and, count, eq, ilike, inArray, or, type SQL } from "drizzle-orm";
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
	const { search, limit, offset = 0 } = options.input;

	const filters = [] as (SQL | undefined)[];

	if (search) {
		const escapeLike = (s: string) =>
			s.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
		const pattern = `%${escapeLike(search)}%`;
		filters.push(
			or(
				ilike(users.name, pattern),
				ilike(users.username, pattern),
				ilike(users.email, pattern),
			),
		);
	}

	// Step 1: Get paginated user IDs
	const pagedUserIdsResult = await db
		.select({ id: users.id })
		.from(users)
		.where(and(...filters))
		.orderBy(users.name)
		.offset(offset)
		.limit(limit ?? 20);

	const pagedUserIds = pagedUserIdsResult.map((u) => u.id);

	if (pagedUserIds.length === 0) {
		const [total] = await db
			.select({
				count: count(users.id),
			})
			.from(users)
			.where(and(...filters));

		return {
			users: [],
			total: total?.count ?? 0,
		};
	}

	// Step 2: Get users and their roles for paginated IDs
	const usersResult = await db
		.select()
		.from(users)
		.leftJoin(userRoles, eq(userRoles.userId, users.id))
		.leftJoin(roles, eq(roles.id, userRoles.roleId))
		.where(inArray(users.id, pagedUserIds))
		.orderBy(users.name);

	const usersMap = new Map<
		number,
		{
			id: number;
			name: string;
			username: string;
			email: string;
			isSystemUser: boolean;
			createdAt: Date;
			updatedAt: Date;
			roles: SelectRole[];
		}
	>();

	usersResult.forEach((row) => {
		const userId = row.users.id;
		if (!usersMap.has(userId)) {
			usersMap.set(userId, {
				id: row.users.id,
				name: row.users.name,
				username: row.users.username,
				email: row.users.email,
				isSystemUser: row.users.isSystemUser,
				createdAt: row.users.createdAt,
				updatedAt: row.users.updatedAt,
				roles: [],
			});
		}
		const user = usersMap.get(userId);
		if (user && row.roles) {
			user.roles.push(row.roles);
		}
	});

	const [total] = await db
		.select({
			count: count(users.id),
		})
		.from(users)
		.where(and(...filters));

	return {
		users: Array.from(usersMap.values()),
		total: total?.count ?? 0,
	};
}
