/**
 * Control Providers - Get
 */

import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";

/**
 * Gets a control provider record by ID with its associated control points
 */
export async function getControlProviderById(id: number) {
	const provider = await prisma.controlProvider.findUnique({
		where: { id },
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

/**
 * Finds a control provider record by ID without throwing an error if not found
 */
export async function findControlProviderById(id: number) {
	return prisma.controlProvider.findUnique({
		where: { id },
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
}
