import * as fs from "node:fs/promises";
import * as path from "node:path";
import { getLogger } from "@ecehive/logger";
import { prisma, type SecurityEventType } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import z from "zod";
import type { TKioskProtectedProcedureContext } from "../../trpc";
import { getSecurityStoragePath } from "./utils";

const logger = getLogger("security:upload");

export const ZUploadSnapshotSchema = z.object({
	// Base64 encoded image data
	imageData: z.string(),
	eventType: z.enum(["TAP", "FACE_ID", "FACE_ID_ENROLLMENT"]),
	userId: z.number().optional(),
	// Face detection metadata from the client
	faceDetected: z.boolean().default(false),
	faceConfidence: z.number().optional(),
});

export type TUploadSnapshotOptions = {
	ctx: TKioskProtectedProcedureContext;
	input: z.infer<typeof ZUploadSnapshotSchema>;
};

/**
 * Generate a unique filename for a snapshot
 */
function generateFilename(
	deviceId: number,
	userId: number | null,
	eventType: string,
): string {
	const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
	const userPart = userId ? `user-${userId}` : "anonymous";
	return `${timestamp}_device-${deviceId}_${userPart}_${eventType}.jpg`;
}

/**
 * Ensure the storage directory exists
 */
async function ensureStorageDir(): Promise<string> {
	const storagePath = getSecurityStoragePath();

	// Create year/month subdirectory for organization
	const now = new Date();
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, "0");
	const fullPath = path.join(storagePath, String(year), month);

	await fs.mkdir(fullPath, { recursive: true });
	return fullPath;
}

export async function uploadSnapshotHandler(options: TUploadSnapshotOptions) {
	const { ctx, input } = options;
	const { imageData, eventType, userId, faceDetected, faceConfidence } = input;

	try {
		// Decode base64 image
		const base64Match = imageData.match(/^data:image\/\w+;base64,(.+)$/);
		const imageBuffer = Buffer.from(
			base64Match ? base64Match[1] : imageData,
			"base64",
		);

		// Validate image size (max 5MB)
		if (imageBuffer.length > 5 * 1024 * 1024) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "Image size exceeds 5MB limit",
			});
		}

		// Generate filename and path
		const storageDir = await ensureStorageDir();
		const filename = generateFilename(ctx.device.id, userId ?? null, eventType);
		const fullPath = path.join(storageDir, filename);

		// Calculate relative path from storage root
		const storagePath = getSecurityStoragePath();
		const relativePath = path.relative(storagePath, fullPath);

		// Validate relative path doesn't contain path traversal sequences
		// This prevents storing paths that could escape the storage directory
		if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
			logger.error("Invalid storage path detected (possible path traversal)", {
				relativePath,
				fullPath,
				storagePath,
			});
			throw new TRPCError({
				code: "INTERNAL_SERVER_ERROR",
				message: "Invalid storage path",
			});
		}

		// Write image to disk
		await fs.writeFile(fullPath, imageBuffer);

		// Create database record
		const snapshot = await prisma.securitySnapshot.create({
			data: {
				deviceId: ctx.device.id,
				userId: userId ?? null,
				eventType: eventType as SecurityEventType,
				imagePath: relativePath,
				capturedAt: new Date(),
				faceDetected,
				faceConfidence: faceConfidence ?? null,
			},
			select: {
				id: true,
				eventType: true,
				capturedAt: true,
				faceDetected: true,
			},
		});

		logger.info("Security snapshot uploaded", {
			snapshotId: snapshot.id,
			deviceId: ctx.device.id,
			userId,
			eventType,
			faceDetected,
		});

		return {
			success: true,
			snapshotId: snapshot.id,
		};
	} catch (error) {
		logger.error("Failed to upload security snapshot", {
			error: error instanceof Error ? error.message : "Unknown error",
			deviceId: ctx.device.id,
			eventType,
		});

		if (error instanceof TRPCError) {
			throw error;
		}

		throw new TRPCError({
			code: "INTERNAL_SERVER_ERROR",
			message: "Failed to save security snapshot",
		});
	}
}
