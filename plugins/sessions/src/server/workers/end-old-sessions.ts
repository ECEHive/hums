import type { WorkerDefinition } from "@ecehive/core";
import { queueEmail } from "@ecehive/email";
import { ConfigService, endSession } from "@ecehive/features";
import { getLogger } from "@ecehive/logger";
import { prisma } from "@ecehive/prisma";
import { CronJob } from "cron";

const logger = getLogger("plugin:sessions:end-old-sessions");

interface SessionToEnd {
	id: number;
	userId: number;
	startedAt: Date;
	sessionType: "regular" | "staffing";
	user: {
		name: string;
		email: string;
	};
}

/**
 * End a single session using the shared endSession() utility so that
 * attendance records are properly closed for staffing sessions.
 * Falls back to a direct update if the shared utility fails, to ensure
 * the session is always ended.
 */
async function endSessionSafely(
	session: SessionToEnd,
	endTime: Date,
): Promise<boolean> {
	try {
		await prisma.$transaction(
			async (tx) => {
				await endSession(tx, session.id, endTime);
			},
			{ maxWait: 5000, timeout: 10000 },
		);
		return true;
	} catch (error) {
		// If endSession fails (e.g., session already ended by a concurrent tap-out),
		// ensure the session is at least marked as ended
		logger.warn("endSession utility failed, falling back to direct update", {
			sessionId: session.id,
			error: error instanceof Error ? error.message : String(error),
		});
		try {
			await prisma.session.updateMany({
				where: { id: session.id, endedAt: null },
				data: { endedAt: endTime },
			});
		} catch (fallbackError) {
			logger.error("Failed to end session even with fallback", {
				sessionId: session.id,
				error:
					fallbackError instanceof Error
						? fallbackError.message
						: String(fallbackError),
			});
			return false;
		}
		return true;
	}
}

/**
 * Ends all active sessions (endedAt == null) that started more than the
 * configured timeout ago. Separate timeouts for regular and staffing sessions.
 * Uses endSession() to properly handle attendance record closure for staffing
 * sessions. Sends email notifications if configured.
 */
export async function endOldSessions(): Promise<void> {
	try {
		const now = new Date();

		// Get configuration values
		const [
			regularEnabled,
			regularHours,
			staffingEnabled,
			staffingHours,
			regularEmailEnabled,
			staffingEmailEnabled,
		] = await Promise.all([
			ConfigService.get("session.timeout.regular.enabled"),
			ConfigService.get("session.timeout.regular.hours"),
			ConfigService.get("session.timeout.staffing.enabled"),
			ConfigService.get("session.timeout.staffing.hours"),
			ConfigService.get("email.sessions.autologout.regular.enabled"),
			ConfigService.get("email.sessions.autologout.staffing.enabled"),
		]);

		let totalEnded = 0;

		// End regular sessions if enabled
		if (regularEnabled) {
			const regularCutoff = new Date(
				now.getTime() - (regularHours as number) * 60 * 60 * 1000,
			);

			const regularSessions = await prisma.session.findMany({
				where: {
					endedAt: null,
					startedAt: { lt: regularCutoff },
					sessionType: "regular",
				},
				include: {
					user: {
						select: {
							name: true,
							email: true,
						},
					},
				},
			});

			for (const session of regularSessions) {
				const ended = await endSessionSafely(session, now);
				if (ended) totalEnded++;
			}

			if (regularSessions.length > 0) {
				logger.info("Ended regular sessions due to timeout", {
					count: regularSessions.length,
					timeoutHours: regularHours as number,
				});

				// Queue email notifications if enabled
				if (regularEmailEnabled) {
					for (const session of regularSessions) {
						try {
							await queueEmail({
								to: session.user.email,
								template: "session-auto-logout",
								data: {
									userName: session.user.name,
									sessionType: "regular",
									startedAt: session.startedAt,
									endedAt: now,
									timeoutHours: regularHours as number,
								},
							});
						} catch (error) {
							logger.warn("Failed to queue logout notification email", {
								userId: session.userId,
								sessionType: "regular",
								error: error instanceof Error ? error.message : String(error),
							});
						}
					}
				}
			}
		}

		// End staffing sessions if enabled
		if (staffingEnabled) {
			const staffingCutoff = new Date(
				now.getTime() - (staffingHours as number) * 60 * 60 * 1000,
			);

			const staffingSessions = await prisma.session.findMany({
				where: {
					endedAt: null,
					startedAt: { lt: staffingCutoff },
					sessionType: "staffing",
				},
				include: {
					user: {
						select: {
							name: true,
							email: true,
						},
					},
				},
			});

			for (const session of staffingSessions) {
				const ended = await endSessionSafely(session, now);
				if (ended) totalEnded++;
			}

			if (staffingSessions.length > 0) {
				logger.info("Ended staffing sessions due to timeout", {
					count: staffingSessions.length,
					timeoutHours: staffingHours as number,
				});

				// Queue email notifications if enabled
				if (staffingEmailEnabled) {
					for (const session of staffingSessions) {
						try {
							await queueEmail({
								to: session.user.email,
								template: "session-auto-logout",
								data: {
									userName: session.user.name,
									sessionType: "staffing",
									startedAt: session.startedAt,
									endedAt: now,
									timeoutHours: staffingHours as number,
								},
							});
						} catch (error) {
							logger.warn("Failed to queue logout notification email", {
								userId: session.userId,
								sessionType: "staffing",
								error: error instanceof Error ? error.message : String(error),
							});
						}
					}
				}
			}
		}

		if (totalEnded > 0) {
			logger.info("Session timeout processing complete", {
				totalEnded,
			});
		}
	} catch (err) {
		logger.error("Failed to end old sessions", {
			error: err instanceof Error ? err.message : String(err),
		});
		throw err;
	}
}

const cronJob = new CronJob("*/1 * * * *", endOldSessions);

/**
 * WorkerDefinition for the sessions plugin.
 *
 * Runs every minute to automatically end sessions that have exceeded their
 * configured timeout duration.
 */
export const endOldSessionsWorker: WorkerDefinition = {
	name: "sessions:end-old-sessions",
	start() {
		cronJob.start();
	},
	stop() {
		cronJob.stop();
	},
};
