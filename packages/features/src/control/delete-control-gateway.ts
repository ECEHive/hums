/**
 * Control Gateways - Delete
 */

import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";

/**
 * Deletes a control gateway by ID
 * Associated actions are cascade-deleted
 */
export async function deleteControlGateway(id: number) {
	const existing = await prisma.controlGateway.findUnique({
		where: { id },
	});

	if (!existing) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Control gateway not found",
		});
	}

	await prisma.controlGateway.delete({
		where: { id },
	});

	return { success: true };
}
