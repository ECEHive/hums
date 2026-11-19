/**
 * Control Gateways - Regenerate access token
 */

import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import { generateAccessToken } from "./create-control-gateway";

/**
 * Replaces a gateway's access token. The old token stops working immediately.
 * Returns the new token unredacted; it is never shown again.
 */
export async function regenerateControlGatewayToken(id: number) {
	const existing = await prisma.controlGateway.findUnique({
		where: { id },
		select: { id: true },
	});
	if (!existing) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Control gateway not found",
		});
	}

	return prisma.controlGateway.update({
		where: { id },
		data: { accessToken: generateAccessToken() },
		select: { id: true, name: true, accessToken: true },
	});
}
