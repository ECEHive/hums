import * as fs from "node:fs/promises";
import { getLogger } from "@ecehive/logger";
import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";
import { validateSecurityFilePath } from "./utils";

const logger = getLogger("security:getImage");

export const ZGetImageSchema = z.object({
	snapshotId: z.string().uuid(),
});

export type TGetImageOptions = {
	ctx: TPermissionProtectedProcedureContext;
	input: z.infer<typeof ZGetImageSchema>;
};

export async function getImageHandler(options: TGetImageOptions) {
	const { input } = options;
	const { snapshotId } = input;

	const snapshot = await prisma.securitySnapshot.findUnique({
		where: { id: snapshotId },
		select: {
			id: true,
			imagePath: true,
			eventType: true,
			capturedAt: true,
		},
	});

	if (!snapshot) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Snapshot not found",
		});
	}

	const storagePath = validateSecurityFilePath(snapshot.imagePath);
	const fullPath = storagePath;

	try {
		const imageBuffer = await fs.readFile(fullPath);
		const base64 = imageBuffer.toString("base64");

		return {
			id: snapshot.id,
			imageData: `data:image/jpeg;base64,${base64}`,
			eventType: snapshot.eventType,
			capturedAt: snapshot.capturedAt,
		};
	} catch (error) {
		logger.error("Failed to read snapshot image", {
			snapshotId,
			path: fullPath,
			error: error instanceof Error ? error.message : "Unknown error",
		});

		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Image file not found",
		});
	}
}
