import { assertCanAccessPeriod, getUserWithRoles } from "@ecehive/features";
import { type Prisma, prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZListEligibleUsersSchema = z.object({
	periodId: z.number().min(1),
	search: z.string().min(1).max(100).optional(),
	limit: z.number().min(1).max(100).optional(),
});

export type TListEligibleUsersSchema = z.infer<typeof ZListEligibleUsersSchema>;

export type TListEligibleUsersOptions = {
	ctx: TPermissionProtectedProcedureContext;
	input: TListEligibleUsersSchema;
};

export async function listEligibleUsersHandler(
	options: TListEligibleUsersOptions,
) {
	const { periodId, search, limit = 25 } = options.input;

	const actor = await getUserWithRoles(prisma, options.ctx.user.id);

	if (!actor) {
		throw new TRPCError({
			code: "UNAUTHORIZED",
			message: "User not found",
		});
	}

	const actorRoleIds = new Set(actor.roles.map((role) => role.id));

	const period = await prisma.period.findUnique({
		where: { id: periodId },
		include: {
			roles: {
				select: { id: true },
			},
		},
	});

	if (!period) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Period not found",
		});
	}

	assertCanAccessPeriod(period, actorRoleIds, {
		isSystemUser: options.ctx.user.isSystemUser,
	});

	const periodRoleIds = period.roles.map((role) => role.id);

	const where: Prisma.UserWhereInput = {};
	const andFilters: Prisma.UserWhereInput[] = [];

	if (periodRoleIds.length > 0) {
		andFilters.push({
			roles: {
				some: {
					id: { in: periodRoleIds },
				},
			},
		});
	}

	if (search) {
		andFilters.push({
			OR: [
				{ name: { contains: search, mode: "insensitive" } },
				{ username: { contains: search, mode: "insensitive" } },
				{ email: { contains: search, mode: "insensitive" } },
			],
		});
	}

	if (andFilters.length > 0) {
		where.AND = andFilters;
	}

	const users = await prisma.user.findMany({
		where,
		orderBy: [{ name: "asc" }],
		take: limit,
		include: {
			roles: {
				select: { id: true, name: true },
			},
		},
	});

	return {
		users,
		periodRoleIds,
		isRoleRestricted: periodRoleIds.length > 0,
	};
}
