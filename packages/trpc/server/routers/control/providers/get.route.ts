/**
 * Control Provider Routes - Get
 */

import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

export const ZGetProviderSchema = z.object({
	id: z.number().int(),
});

export async function getProviderHandler({
	input,
}: {
	input: z.infer<typeof ZGetProviderSchema>;
}) {
	const provider = await prisma.controlProvider.findUnique({
		where: { id: input.id },
		include: {
			controlPoints: {
				select: {
					id: true,
					name: true,
					location: true,
					controlClass: true,
					isActive: true,
				},
			},
		},
	});

	if (!provider) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Control provider not found",
		});
	}

	return provider;
}
