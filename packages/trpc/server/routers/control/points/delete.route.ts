/**
 * Control Points Routes - Delete
 */

import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

export const ZDeletePointSchema = z.object({
	id: z.string().uuid(),
});

export async function deletePointHandler({
	input,
}: {
	input: z.infer<typeof ZDeletePointSchema>;
}) {
	const existing = await prisma.controlPoint.findUnique({
		where: { id: input.id },
	});

	if (!existing) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Control point not found",
		});
	}

	// Delete the control point (logs will be cascade deleted)
	await prisma.controlPoint.delete({
		where: { id: input.id },
	});

	return { success: true };
}
