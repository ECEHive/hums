import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";

export async function ensureUserHasPermission(options: {
	userId: number;
	permission: string;
	skip?: boolean;
}) {
	const { userId, permission, skip } = options;

	if (skip) {
		return;
	}

	const match = await prisma.permission.findFirst({
		where: {
			name: permission,
			roles: {
				some: {
					users: {
						some: {
							id: userId,
						},
					},
				},
			},
		},
	});

	if (!match) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "You do not have permission to perform this action",
		});
	}
}
