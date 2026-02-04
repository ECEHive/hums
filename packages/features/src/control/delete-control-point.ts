/**
 * Control Points - Delete
 */

import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";

/**
 * Deletes a control point by ID
 */
export async function deleteControlPoint(id: string) {
	const existing = await prisma.controlPoint.findUnique({
		where: { id },
	});

	if (!existing) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Control point not found",
		});
	}

	// Delete the control point (logs will be cascade deleted)
	await prisma.controlPoint.delete({
		where: { id },
	});

	return { success: true };
}
