/**
 * Control Provider Routes - Update
 */

import type { ControlProviderType, Prisma } from "@ecehive/prisma";
import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { validateProviderConfig } from "./index";

export const ZUpdateProviderSchema = z.object({
	id: z.number().int(),
	name: z.string().min(1).max(255).optional(),
	config: z.record(z.string(), z.unknown()).optional(),
	isActive: z.boolean().optional(),
});

export async function updateProviderHandler({
	input,
}: {
	input: z.infer<typeof ZUpdateProviderSchema>;
}) {
	const existing = await prisma.controlProvider.findUnique({
		where: { id: input.id },
	});

	if (!existing) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Control provider not found",
		});
	}

	// If config is being updated, validate it
	if (input.config) {
		const validation = validateProviderConfig(
			existing.providerType as ControlProviderType,
			input.config,
		);
		if (!validation.valid) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: `Invalid provider configuration: ${validation.error}`,
			});
		}
	}

	// Check for name conflict
	if (input.name && input.name !== existing.name) {
		const nameConflict = await prisma.controlProvider.findUnique({
			where: { name: input.name },
		});
		if (nameConflict) {
			throw new TRPCError({
				code: "CONFLICT",
				message: "A control provider with this name already exists",
			});
		}
	}

	const provider = await prisma.controlProvider.update({
		where: { id: input.id },
		data: {
			name: input.name,
			config: input.config
				? (input.config as unknown as Prisma.InputJsonValue)
				: undefined,
			isActive: input.isActive,
		},
	});

	return provider;
}
