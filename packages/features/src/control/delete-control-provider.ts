/**
 * Control Providers - Delete
 */

import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";

/**
 * Deletes a control provider by ID
 * Will fail if there are associated control points
 */
export async function deleteControlProvider(id: number) {
	const existing = await prisma.controlProvider.findUnique({
		where: { id },
		include: {
			_count: {
				select: { controlPoints: true },
			},
		},
	});

	if (!existing) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Control provider not found",
		});
	}

	// Prevent deletion if there are associated control points
	if (existing._count.controlPoints > 0) {
		throw new TRPCError({
			code: "PRECONDITION_FAILED",
			message:
				"Cannot delete provider with associated control points. Please remove or reassign control points first.",
		});
	}

	await prisma.controlProvider.delete({
		where: { id },
	});

	return { success: true };
}
