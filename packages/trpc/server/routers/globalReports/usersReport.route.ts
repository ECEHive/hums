import { prisma } from "@ecehive/prisma";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZUsersReportSchema = z.object({
	filterRoleIds: z.array(z.number()).optional(),
});

export type TUsersReportSchema = z.infer<typeof ZUsersReportSchema>;

export type TUsersReportOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TUsersReportSchema;
};

export async function usersReportHandler(options: TUsersReportOptions) {
	const { filterRoleIds } = options.input;

	// Build where clause
	const where: {
		roles?: { some: { id: { in: number[] } } };
	} = {};

	// Filter by roles if specified
	if (filterRoleIds && filterRoleIds.length > 0) {
		where.roles = {
			some: {
				id: { in: filterRoleIds },
			},
		};
	}

	const users = await prisma.user.findMany({
		where,
		select: {
			id: true,
			username: true,
			name: true,
			email: true,
			slackUsername: true,
			isSystemUser: true,
			createdAt: true,
			updatedAt: true,
			roles: {
				select: {
					id: true,
					name: true,
				},
				orderBy: { name: "asc" },
			},
			_count: {
				select: {
					sessions: true,
				},
			},
		},
		orderBy: { name: "asc" },
	});

	const reports = users.map((user) => ({
		id: user.id,
		username: user.username,
		name: user.name,
		email: user.email,
		slackUsername: user.slackUsername,
		isSystemUser: user.isSystemUser,
		createdAt: user.createdAt,
		roles: user.roles.map((r) => r.name).join(", "),
		roleCount: user.roles.length,
		totalSessions: user._count.sessions,
	}));

	return {
		reports,
		total: reports.length,
	};
}
