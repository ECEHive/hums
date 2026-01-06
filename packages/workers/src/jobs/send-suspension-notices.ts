import { queueEmail } from "@ecehive/email";
import {
	getSuspensionsStartingSoon,
	markSuspensionEmailSent,
} from "@ecehive/features";
import { getLogger } from "@ecehive/logger";
import { prisma } from "@ecehive/prisma";
import { CronJob } from "cron";

const logger = getLogger("workers:suspension-notices");

/**
 * Sends email notifications for suspensions that are starting soon.
 *
 * This worker runs every 5 minutes and:
 * 1. Finds suspensions where startDate is within the next 5 minutes AND emailSentAt is null
 * 2. Sends a suspension notice email to each affected user
 * 3. Marks the suspension as having had its email sent
 *
 * The timing ensures:
 * - An email is always sent for every suspension (checked every 5 minutes, looking 5 minutes ahead)
 * - Only one email is sent per suspension (tracked via emailSentAt)
 */
export async function sendSuspensionNotices(): Promise<void> {
	try {
		// Get suspensions starting within the next 5 minutes that haven't had emails sent
		const suspensions = await getSuspensionsStartingSoon(prisma, 5);

		if (suspensions.length === 0) {
			return;
		}

		logger.info("Processing suspension notices", { count: suspensions.length });

		for (const suspension of suspensions) {
			try {
				// Queue the suspension notice email
				await queueEmail({
					to: suspension.user.email,
					template: "suspension-notice",
					data: {
						userName: suspension.user.name,
						startDate: suspension.startDate,
						endDate: suspension.endDate,
						externalNotes: suspension.externalNotes,
					},
				});

				// Mark the suspension as having its email sent
				await markSuspensionEmailSent(prisma, suspension.id);

				logger.info("Queued suspension notice email", {
					suspensionId: suspension.id,
					userId: suspension.userId,
					startDate: suspension.startDate.toISOString(),
				});
			} catch (error) {
				logger.warn("Failed to queue suspension notice email", {
					suspensionId: suspension.id,
					userId: suspension.userId,
					error: error instanceof Error ? error.message : String(error),
				});
				// Continue with other suspensions even if one fails
			}
		}

		logger.info("Finished processing suspension notices", {
			processed: suspensions.length,
		});
	} catch (err) {
		logger.error("Failed to process suspension notices", {
			error: err instanceof Error ? err.message : String(err),
		});
		throw err;
	}
}

// Run every 5 minutes
export const sendSuspensionNoticesJob = new CronJob(
	"*/5 * * * *",
	sendSuspensionNotices,
);
