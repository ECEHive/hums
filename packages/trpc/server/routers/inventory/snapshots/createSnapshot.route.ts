import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../../trpc";

export const ZCreateSnapshotSchema = z.object({
	itemId: z.string().uuid(),
	quantity: z.number().int().min(0),
});

export type TCreateSnapshotSchema = z.infer<typeof ZCreateSnapshotSchema>;

export type TCreateSnapshotOptions = {
	ctx: TPermissionProtectedProcedureContext;
	input: TCreateSnapshotSchema;
};

export async function createSnapshotHandler(options: TCreateSnapshotOptions) {
	const { itemId, quantity } = options.input;

	// Verify item exists
	const item = await prisma.item.findUnique({
		where: { id: itemId },
	});

	if (!item) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Item not found",
		});
	}

	const snapshot = await prisma.inventorySnapshot.upsert({
		where: { itemId },
		update: {
			quantity,
			takenAt: new Date(),
		},
		create: {
			itemId,
			quantity,
		},
	});

	return snapshot;
}
