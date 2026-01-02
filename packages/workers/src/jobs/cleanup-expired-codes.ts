import { getLogger } from "@ecehive/logger";
import { prisma } from "@ecehive/prisma";
import { CronJob } from "cron";

const logger = getLogger("workers:cleanup-codes");

/**
 * Deletes all expired or old used one-time login codes.
 * Codes are deleted if:
 * - They have expired (expiresAt < now)
 * - They were used more than 15 minutes ago
 * Runs every 15 minutes.
 */
export async function cleanupExpiredCodes(): Promise<void> {
	try {
		const now = new Date();
		const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);

		// Delete all codes that have expired OR were used more than 15 minutes ago
		const result = await prisma.oneTimeAccessCode.deleteMany({
			where: {
				OR: [
					{ expiresAt: { lt: now } },
					{
						usedAt: { not: null, lt: fifteenMinutesAgo },
					},
				],
			},
		});

		if (result.count > 0) {
			logger.info("Cleaned up expired codes", { count: result.count });
		}
	} catch (err) {
		logger.error("Failed to cleanup expired codes", {
			error: err instanceof Error ? err.message : String(err),
		});
		throw err;
	}
}

// Run every 15 minutes
export const cleanupExpiredCodesJob = new CronJob(
	"*/15 * * * *",
	cleanupExpiredCodes,
);
