import { prisma } from "@ecehive/prisma";
import { CronJob } from "cron";

/**
 * Deletes all expired one-time login codes.
 * Runs every 15 minutes.
 */
export async function cleanupExpiredCodes(): Promise<void> {
	try {
		const now = new Date();

		// Delete all codes that have expired
		const result = await prisma.oneTimeAccessCode.deleteMany({
			where: {
				expiresAt: { lt: now },
			},
		});

		if (result.count > 0) {
			console.info(`Deleted ${result.count} expired one-time login code(s).`);
		}
	} catch (err) {
		console.error("cleanupExpiredCodes error:", err);
		throw err;
	}
}

// Run every 15 minutes
export const cleanupExpiredCodesJob = new CronJob(
	"*/15 * * * *",
	cleanupExpiredCodes,
);
