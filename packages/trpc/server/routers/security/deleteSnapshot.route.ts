import * as fs from "node:fs/promises";
import * as path from "node:path";
import { env } from "@ecehive/env";
import { getLogger } from "@ecehive/logger";
import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

const logger = getLogger("security:delete");

export const ZDeleteSnapshotSchema = z.object({
	snapshotId: z.string().uuid(),
});

export type TDeleteSnapshotOptions = {
	ctx: TPermissionProtectedProcedureContext;
	input: z.infer<typeof ZDeleteSnapshotSchema>;
};

export async function deleteSnapshotHandler(options: TDeleteSnapshotOptions) {
	const { ctx, input } = options;
	const { snapshotId } = input;

	const snapshot = await prisma.securitySnapshot.findUnique({
		where: { id: snapshotId },
		select: {
			id: true,
			imagePath: true,
		},
	});

	if (!snapshot) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Snapshot not found",
		});
	}

	// Delete file from disk
	const storagePath = path.resolve(env.SECURITY_STORAGE_PATH);
	const fullPath = path.join(storagePath, snapshot.imagePath);

	try {
		await fs.unlink(fullPath);
	} catch (error) {
		// Log but don't fail if file is already gone
		logger.warn("Failed to delete snapshot file", {
			snapshotId,
			path: fullPath,
			error: error instanceof Error ? error.message : "Unknown error",
		});
	}

	// Delete database record
	await prisma.securitySnapshot.delete({
		where: { id: snapshotId },
	});

	logger.info("Security snapshot deleted", {
		snapshotId,
		deletedBy: ctx.user.id,
	});

	return { success: true };
}
