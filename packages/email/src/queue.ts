import { emailQueue } from "./email-queue";
import type { RenderEmailOptions } from "./template-renderer.js";

export type QueueEmailParams = RenderEmailOptions & {
	to: string;
};

/**
 * Queue an email to be sent asynchronously
 * This is non-blocking and returns immediately
 * The email will be processed by the background processor
 * @param params Email parameters including recipient, template, and data
 * @returns Email ID for tracking
 */
export function queueEmail(params: QueueEmailParams): string {
	return emailQueue.add(params);
}

/**
 * Queue multiple emails at once
 * More efficient than calling queueEmail multiple times
 * @param emails Array of email parameters
 * @returns Array of email IDs
 */
export function queueEmails(emails: QueueEmailParams[]): string[] {
	return emailQueue.addMany(emails);
}

/**
 * Get current email queue status
 */
export function getQueueStatus() {
	return emailQueue.getStatus();
}

/**
 * Clear all pending emails from queue
 * Use with caution - only for testing/maintenance
 */
export function clearQueue(): void {
	emailQueue.clear();
}
