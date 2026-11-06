import { queueEmail } from "@ecehive/email";
import {
	claimSuspensionEmail,
	getUnnotifiedSuspensions,
} from "@ecehive/features";
import { getLogger } from "@ecehive/logger";
import { prisma } from "@ecehive/prisma";
import { CronJob } from "cron";

const logger = getLogger("workers:suspension-notices");

/**
 * Sends email notifications for suspensions that haven't been notified yet.
 *
 * This worker runs every 5 minutes and:
 * 1. Finds active suspensions (started and not ended) where emailSentAt is null
 * 2. Sets emailSentAt then queues the suspension notice email
 *
 * Every suspension is emailed once, shortly after it starts
 */
export async function sendSuspensionNotices(): Promise<void> {
	try {
		const suspensions = await getUnnotifiedSuspensions(prisma);

		if (suspensions.length === 0) {
			return;
		}

		logger.info("Processing suspension notices", { count: suspensions.length });

		let queued = 0;

		for (const suspension of suspensions) {
			try {
				// Claim the record first so concurrent runs never send duplicates
				const claimed = await claimSuspensionEmail(prisma, suspension.id);
				if (!claimed) continue;

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
				queued++;

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

		logger.info("Finished processing suspension notices", { queued });
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
