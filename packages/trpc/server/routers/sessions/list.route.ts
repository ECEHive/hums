import { type Prisma, prisma } from "@ecehive/prisma";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZListSchema = z.object({
	limit: z.number().min(1).max(100).optional(),
	offset: z.number().min(0).optional(),
	filterUser: z.string().min(2).max(100).optional(),
	filterUserId: z.number().min(1).optional(),
	filterSessionType: z.enum(["regular", "staffing"]).optional(),
});

export type TListSchema = z.infer<typeof ZListSchema>;

export type TListOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TListSchema;
};

export async function listHandler(options: TListOptions) {
	const {
		filterUser,
		filterUserId,
		filterSessionType,
		limit = 50,
		offset = 0,
	} = options.input;

	const where: Prisma.SessionWhereInput = {};

	if (filterUserId === undefined && filterUser) {
		where.user = {
			OR: [
				{ name: { contains: filterUser, mode: "insensitive" } },
				{
					username: {
						contains: filterUser,
						mode: "insensitive",
					},
				},
				{
					email: {
						contains: filterUser,
						mode: "insensitive",
					},
				},
			],
		};
	}

	if (filterUserId) {
		where.userId = filterUserId;
	}

	if (filterSessionType) {
		where.sessionType = filterSessionType;
	}

	const [sessions, total] = await Promise.all([
		prisma.session.findMany({
			where,
			orderBy: { startedAt: "desc" },
			skip: offset,
			take: limit,
			include: {
				user: {
					select: {
						id: true,
						name: true,
						username: true,
						email: true,
					},
				},
			},
		}),
		prisma.session.count({ where }),
	]);

	return {
		sessions,
		total,
	};
}
