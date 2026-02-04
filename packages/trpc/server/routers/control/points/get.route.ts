/**
 * Control Points Routes - Get
 */

import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

export const ZGetPointSchema = z.object({
	id: z.string().uuid(),
});

export async function getPointHandler({
	input,
}: {
	input: z.infer<typeof ZGetPointSchema>;
}) {
	const point = await prisma.controlPoint.findUnique({
		where: { id: input.id },
		include: {
			provider: {
				select: {
					id: true,
					name: true,
					providerType: true,
					isActive: true,
				},
			},
			authorizedRoles: {
				select: { id: true, name: true },
			},
			authorizedUsers: {
				select: { id: true, name: true, username: true, email: true },
			},
		},
	});

	if (!point) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Control point not found",
		});
	}

	return point;
}
