/**
 * Control Providers - Get
 */

import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";

/**
 * Placeholder for redacted provider credentials
 */
const REDACTED_CONFIG = { _redacted: true };

/**
 * Gets a control provider record by ID with its associated control points
 * Provider config is redacted to prevent exposure of credentials
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

	// Redact sensitive config field
	return {
		...provider,
		config: REDACTED_CONFIG,
	};
}

/**
 * Finds a control provider record by ID without throwing an error if not found
 * Provider config is redacted to prevent exposure of credentials
 */
export async function findControlProviderById(id: number) {
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
		return null;
	}

	// Redact sensitive config field
	return {
		...provider,
		config: REDACTED_CONFIG,
	};
}
