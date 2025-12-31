import { getEmailProvider } from "./providers";
import { type RenderEmailOptions, renderEmail } from "./template-renderer";

/**
 * Queued email metadata that extends the base template options
 */
interface QueuedEmailMetadata {
	to: string;
	id: string;
	attempts: number;
	createdAt: Date;
	lastError?: string;
}

/**
 * Type-safe queued email that combines template options with queue metadata
 */
export type QueuedEmail = RenderEmailOptions & QueuedEmailMetadata;

class EmailQueue {
	private queue: QueuedEmail[] = [];
	private processing = false;
	private maxAttempts = 3;
	private nextId = 1;
	private processingTimeout: ReturnType<typeof setTimeout> | null = null;
	// Rate limiting: maximum 3 emails per second
	private readonly emailsPerSecond = 3;
	private readonly delayBetweenEmails = 1000 / this.emailsPerSecond; // ~333ms between emails

	/**
	 * Add an email to the in-memory queue
	 * This is non-blocking and returns immediately
	 */
	add(params: RenderEmailOptions & { to: string }): string {
		const id = `email_${this.nextId++}_${Date.now()}`;

		const queuedEmail = {
			to: params.to,
			template: params.template,
			data: params.data,
			id,
			attempts: 0,
			createdAt: new Date(),
		} as QueuedEmail;

		this.queue.push(queuedEmail);

		// Trigger processing if not already running (non-blocking)
		this.scheduleProcessing();

		return id;
	}

	/**
	 * Add multiple emails to the queue
	 */
	addMany(emails: (RenderEmailOptions & { to: string })[]): string[] {
		const ids = emails.map((email) => this.add(email));
		return ids;
	}

	/**
	 * Schedule processing to run asynchronously
	 * Uses setTimeout to avoid blocking the current thread
	 */
	private scheduleProcessing(): void {
		if (this.processingTimeout) {
			return; // Already scheduled
		}

		this.processingTimeout = setTimeout(() => {
			this.processingTimeout = null;
			this.process().catch((error) => {
				console.error("❌ Email queue processing error:", error);
			});
		}, 0);
	}

	/**
	 * Process all emails in the queue
	 * Only one processor runs at a time
	 */
	private async process(): Promise<void> {
		if (this.processing) {
			return; // Already processing
		}

		if (this.queue.length === 0) {
			return;
		}

		this.processing = true;
		console.log(`📧 Processing ${this.queue.length} emails in queue...`);

		const provider = getEmailProvider();
		let processed = 0;
		let failed = 0;

		while (this.queue.length > 0) {
			const email = this.queue[0]; // Peek at first email

			try {
				// Render the template with proper type inference
				// TypeScript discriminated union ensures type safety here
				const rendered = await renderEmail(email as RenderEmailOptions);

				// Send the email
				await provider.sendEmail({
					to: email.to,
					subject: rendered.subject,
					html: rendered.html,
					text: rendered.text,
				});

				// Remove from queue on success
				this.queue.shift();
				processed++;
				console.log(`   ✓ Sent ${email.template} to ${email.to} (${email.id})`);

				// Rate limiting: wait before sending next email
				if (this.queue.length > 0) {
					await new Promise((resolve) =>
						setTimeout(resolve, this.delayBetweenEmails),
					);
				}
			} catch (error) {
				const errorMessage =
					error instanceof Error ? error.message : String(error);

				email.attempts++;
				email.lastError = errorMessage;

				if (email.attempts >= this.maxAttempts) {
					// Remove after max attempts
					this.queue.shift();
					failed++;
					console.error(
						`   ✗ Failed ${email.template} to ${email.to} after ${email.attempts} attempts: ${errorMessage}`,
					);
				} else {
					// Move to end of queue for retry
					this.queue.shift();
					this.queue.push(email);
					console.error(
						`   ⚠️  Retry ${email.template} to ${email.to} (attempt ${email.attempts}/${this.maxAttempts}): ${errorMessage}`,
					);
				}
			}
		}

		this.processing = false;
		console.log(`📊 Email batch complete: ${processed} sent, ${failed} failed`);
	}

	/**
	 * Get current queue status
	 */
	getStatus() {
		return {
			pending: this.queue.length,
			processing: this.processing,
			oldestEmail: this.queue[0]?.createdAt,
		};
	}

	/**
	 * Clear all emails from queue
	 */
	clear(): void {
		this.queue = [];
		console.log("🗑️  Email queue cleared");
	}
}

// Export singleton instance
export const emailQueue = new EmailQueue();
