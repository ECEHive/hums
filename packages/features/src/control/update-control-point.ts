/**
 * Control Points - Update
 */

import type { ControlProviderType, Prisma } from "@ecehive/prisma";
import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import { validatePointConfig } from "./providers";

export interface UpdateControlPointInput {
	id: string;
	name?: string;
	description?: string | null;
	location?: string | null;
	controlClass?: "SWITCH" | "DOOR";
	canControlOnline?: boolean;
	canControlWithCode?: boolean;
	providerId?: number;
	providerConfig?: Record<string, unknown>;
	authorizedRoleIds?: number[];
	authorizedUserIds?: number[];
	autoTurnOffEnabled?: boolean;
	autoTurnOffMinutes?: number | null;
	isActive?: boolean;
}

/**
 * Updates an existing control point
 */
export async function updateControlPoint(input: UpdateControlPointInput) {
	const existing = await prisma.controlPoint.findUnique({
		where: { id: input.id },
		include: { provider: true },
	});

	if (!existing) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Control point not found",
		});
	}

	// If changing provider, verify new provider exists
	let providerType = existing.provider.providerType;
	if (input.providerId && input.providerId !== existing.providerId) {
		const newProvider = await prisma.controlProvider.findUnique({
			where: { id: input.providerId },
		});
		if (!newProvider) {
			throw new TRPCError({
				code: "NOT_FOUND",
				message: "New control provider not found",
			});
		}
		providerType = newProvider.providerType;
	}

	// If config is being updated, validate it
	if (input.providerConfig) {
		const validation = validatePointConfig(
			providerType as ControlProviderType,
			input.providerConfig,
		);
		if (!validation.valid) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: `Invalid point configuration: ${validation.error}`,
			});
		}
	}

	// Build the update data
	const updateData: Parameters<typeof prisma.controlPoint.update>[0]["data"] = {
		name: input.name,
		description: input.description,
		location: input.location,
		controlClass: input.controlClass,
		canControlOnline: input.canControlOnline,
		canControlWithCode: input.canControlWithCode,
		providerId: input.providerId,
		providerConfig: input.providerConfig
			? (input.providerConfig as unknown as Prisma.InputJsonValue)
			: undefined,
		autoTurnOffEnabled: input.autoTurnOffEnabled,
		autoTurnOffMinutes: input.autoTurnOffMinutes,
		isActive: input.isActive,
	};

	// Handle role connections
	if (input.authorizedRoleIds !== undefined) {
		updateData.authorizedRoles = {
			set: input.authorizedRoleIds.map((id) => ({ id })),
		};
	}

	// Handle user connections
	if (input.authorizedUserIds !== undefined) {
		updateData.authorizedUsers = {
			set: input.authorizedUserIds.map((id) => ({ id })),
		};
	}

	const point = await prisma.controlPoint.update({
		where: { id: input.id },
		data: updateData,
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
