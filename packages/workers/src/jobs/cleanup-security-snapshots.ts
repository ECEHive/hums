import * as fs from "node:fs/promises";
import * as path from "node:path";
import { env } from "@ecehive/env";
import { getLogger } from "@ecehive/logger";
import { prisma } from "@ecehive/prisma";
import { CronJob } from "cron";

const logger = getLogger("workers:cleanup-security-snapshots");

/**
 * Get the resolved security storage path.
 * Mirrors the implementation in trpc security utils for consistency.
 */
function getSecurityStoragePath(): string {
	const configuredPath = env.SECURITY_STORAGE_PATH;
	return path.resolve(configuredPath);
}

/**
 * Deletes security snapshots older than the configured retention period.
 * Removes both the database record and the image file from disk.
 * Also cleans up empty directories left behind.
 * Runs once per day at 3:00 AM.
 */
export async function cleanupSecuritySnapshots(): Promise<void> {
	try {
		const retentionDays = env.SECURITY_RETENTION_DAYS ?? 7;
		const cutoffDate = new Date();
		cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

		// Find all snapshots older than the retention period
		const oldSnapshots = await prisma.securitySnapshot.findMany({
			where: {
				capturedAt: { lt: cutoffDate },
			},
			select: {
				id: true,
				imagePath: true,
			},
		});

		if (oldSnapshots.length === 0) {
			logger.debug("No old security snapshots to clean up");
			return;
		}

		logger.info("Cleaning up old security snapshots", {
			count: oldSnapshots.length,
			retentionDays,
			cutoffDate: cutoffDate.toISOString(),
		});

		const basePath = getSecurityStoragePath();
		let deletedFiles = 0;
		let deletedRecords = 0;
		const failedDeletions: string[] = [];

		// Delete each snapshot
		for (const snapshot of oldSnapshots) {
			try {
				// Delete the file from disk
				const fullPath = path.join(basePath, snapshot.imagePath);
				try {
					await fs.unlink(fullPath);
					deletedFiles++;
				} catch (fileErr) {
					// File might already be deleted, log and continue
					if ((fileErr as NodeJS.ErrnoException).code !== "ENOENT") {
						logger.warn("Failed to delete snapshot file", {
							snapshotId: snapshot.id,
							imagePath: snapshot.imagePath,
							error:
								fileErr instanceof Error ? fileErr.message : String(fileErr),
						});
					}
				}

				// Delete the database record
				await prisma.securitySnapshot.delete({
					where: { id: snapshot.id },
				});
				deletedRecords++;
			} catch (err) {
				failedDeletions.push(snapshot.id);
				logger.error("Failed to delete security snapshot", {
					snapshotId: snapshot.id,
					error: err instanceof Error ? err.message : String(err),
				});
			}
		}

		// Try to clean up empty directories
		await cleanupEmptyDirectories(basePath);

		logger.info("Completed security snapshot cleanup", {
			deletedFiles,
			deletedRecords,
			failedCount: failedDeletions.length,
		});
	} catch (err) {
		logger.error("Failed to cleanup security snapshots", {
			error: err instanceof Error ? err.message : String(err),
		});
		throw err;
	}
}

/**
 * Recursively removes empty directories within the security storage path.
 */
async function cleanupEmptyDirectories(dirPath: string): Promise<boolean> {
	try {
		const entries = await fs.readdir(dirPath, { withFileTypes: true });

		// Process subdirectories first
		for (const entry of entries) {
			if (entry.isDirectory()) {
				const subDirPath = path.join(dirPath, entry.name);
				await cleanupEmptyDirectories(subDirPath);
			}
		}

		// Re-read directory after processing subdirectories
		const remainingEntries = await fs.readdir(dirPath);

		// If directory is empty, remove it (but not the base path)
		const basePath = getSecurityStoragePath();
		if (remainingEntries.length === 0 && dirPath !== basePath) {
			await fs.rmdir(dirPath);
			logger.debug("Removed empty directory", { dirPath });
			return true;
		}

		return false;
	} catch (err) {
		// Directory might not exist or permission issues
		if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
			logger.warn("Failed to cleanup directory", {
				dirPath,
				error: err instanceof Error ? err.message : String(err),
			});
		}
		return false;
	}
}

// Run every day at 3:00 AM
export const cleanupSecuritySnapshotsJob = new CronJob(
	"0 3 * * *",
	cleanupSecuritySnapshots,
);
