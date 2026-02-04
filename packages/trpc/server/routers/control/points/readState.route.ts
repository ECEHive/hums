/**
 * Control Points Routes - Read State
 *
 * This route reads the current state of a control point from the provider
 */

import type { ControlProviderType } from "@ecehive/prisma";
import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getControlProvider } from "../providers";

export const ZReadStateSchema = z.object({
	id: z.string().uuid(),
});

export async function readStateHandler({
	input,
}: {
	input: z.infer<typeof ZReadStateSchema>;
}) {
	const point = await prisma.controlPoint.findUnique({
		where: { id: input.id },
		include: {
			provider: true,
		},
	});

	if (!point) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Control point not found",
		});
	}

	if (!point.isActive || !point.provider.isActive) {
		return {
			success: true,
			state: point.currentState,
			fromCache: true,
		};
	}

	// Get the provider implementation
	const provider = getControlProvider(
		point.provider.providerType as ControlProviderType,
	);

	// Read the current state
	const result = await provider.readState(
		point.provider.config,
		point.providerConfig,
	);

	if (result.success && result.state !== undefined) {
		// Update the cached state
		await prisma.controlPoint.update({
			where: { id: point.id },
			data: { currentState: result.state },
		});

		return {
			success: true,
			state: result.state,
			fromCache: false,
		};
	}

	// Return cached state on failure
	return {
		success: false,
		state: point.currentState,
		fromCache: true,
		error: result.errorMessage,
	};
}
