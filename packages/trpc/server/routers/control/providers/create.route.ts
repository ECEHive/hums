/**
 * Control Provider Routes - Create
 */

import type { ControlProviderType, Prisma } from "@ecehive/prisma";
import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { validateProviderConfig } from "./index";

export const ZCreateProviderSchema = z.object({
	name: z.string().min(1).max(255),
	providerType: z.enum(["GEORGIA_TECH_PLC"]),
	config: z.record(z.string(), z.unknown()),
	isActive: z.boolean().optional(),
});

export async function createProviderHandler({
	input,
}: {
	input: z.infer<typeof ZCreateProviderSchema>;
}) {
	// Validate the provider configuration for the given type
	const validation = validateProviderConfig(
		input.providerType as ControlProviderType,
		input.config,
	);
	if (!validation.valid) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: `Invalid provider configuration: ${validation.error}`,
		});
	}

	// Check for existing provider with the same name
	const existing = await prisma.controlProvider.findUnique({
		where: { name: input.name },
	});

	if (existing) {
		throw new TRPCError({
			code: "CONFLICT",
			message: "A control provider with this name already exists",
		});
	}

	const provider = await prisma.controlProvider.create({
		data: {
			name: input.name,
			providerType: input.providerType,
			config: input.config as unknown as Prisma.InputJsonValue,
			isActive: input.isActive ?? true,
		},
	});

	return provider;
}
