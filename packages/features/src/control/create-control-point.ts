/**
 * Control Points - Create
 */

import type { ControlProviderType, Prisma } from "@ecehive/prisma";
import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import { validatePointConfig } from "./providers";

export interface CreateControlPointInput {
	name: string;
	description?: string;
	location?: string;
	controlClass: "SWITCH" | "DOOR";
	canControlOnline?: boolean;
	canControlWithCode?: boolean;
	providerId: number;
	providerConfig: Record<string, unknown>;
	authorizedRoleIds?: number[];
	authorizedUserIds?: number[];
	isActive?: boolean;
}

/**
 * Creates a new control point
 */
export async function createControlPoint(input: CreateControlPointInput) {
	// Verify provider exists and get its type
	const provider = await prisma.controlProvider.findUnique({
		where: { id: input.providerId },
	});

	if (!provider) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Control provider not found",
		});
	}

	// Validate the point configuration for the provider type
	const validation = validatePointConfig(
		provider.providerType as ControlProviderType,
		input.providerConfig,
	);
	if (!validation.valid) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: `Invalid point configuration: ${validation.error}`,
		});
	}

	const point = await prisma.controlPoint.create({
		data: {
			name: input.name,
			description: input.description,
			location: input.location,
			controlClass: input.controlClass,
			canControlOnline: input.canControlOnline ?? true,
			canControlWithCode: input.canControlWithCode ?? false,
			providerId: input.providerId,
			providerConfig: input.providerConfig as unknown as Prisma.InputJsonValue,
			isActive: input.isActive ?? true,
			authorizedRoles: input.authorizedRoleIds?.length
				? { connect: input.authorizedRoleIds.map((id) => ({ id })) }
				: undefined,
			authorizedUsers: input.authorizedUserIds?.length
				? { connect: input.authorizedUserIds.map((id) => ({ id })) }
				: undefined,
		},
		include: {
			provider: {
				select: {
					id: true,
					name: true,
					providerType: true,
				},
			},
			authorizedRoles: {
				select: { id: true, name: true },
			},
			authorizedUsers: {
				select: { id: true, name: true, username: true },
			},
		},
	});

	return point;
}
