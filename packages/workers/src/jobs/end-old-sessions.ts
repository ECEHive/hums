import { queueEmail } from "@ecehive/email";
import { ConfigService } from "@ecehive/features";
import { prisma } from "@ecehive/prisma";
import { CronJob } from "cron";

/**
 * Ends all active sessions (endedAt == null) that started more than the configured timeout ago.
 * Separate timeouts for regular and staffing sessions.
 * Sends email notifications if configured.
 * Runs every 5 minutes.
 */
export async function endOldSessions(): Promise<void> {
	try {
		const now = new Date();

		// Get configuration values
		const regularEnabled = await ConfigService.get(
			"session.timeout.regular.enabled",
		);
		const regularHours = await ConfigService.get(
			"session.timeout.regular.hours",
		);
		const staffingEnabled = await ConfigService.get(
			"session.timeout.staffing.enabled",
		);
		const staffingHours = await ConfigService.get(
			"session.timeout.staffing.hours",
		);
		const regularEmailEnabled = await ConfigService.get(
			"email.sessions.autologout.regular.enabled",
		);
		const staffingEmailEnabled = await ConfigService.get(
			"email.sessions.autologout.staffing.enabled",
		);

		let totalEnded = 0;

		// End regular sessions if enabled
		if (regularEnabled) {
			const regularCutoff = new Date(
				now.getTime() - regularHours * 60 * 60 * 1000,
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

			if (regularSessions.length > 0) {
				const ids = regularSessions.map((s) => s.id);
				await prisma.session.updateMany({
					where: { id: { in: ids }, endedAt: null },
					data: { endedAt: now },
				});
				totalEnded += ids.length;
				console.info(
					`Ended ${ids.length} regular session(s) older than ${regularHours} hours.`,
				);

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
									timeoutHours: regularHours,
								},
							});
						} catch (error) {
							console.error(
								`Failed to queue email for user ${session.userId}:`,
								error,
							);
						}
					}
				}
			}
		}

		// End staffing sessions if enabled
		if (staffingEnabled) {
			const staffingCutoff = new Date(
				now.getTime() - staffingHours * 60 * 60 * 1000,
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

			if (staffingSessions.length > 0) {
				const ids = staffingSessions.map((s) => s.id);
				await prisma.session.updateMany({
					where: { id: { in: ids }, endedAt: null },
					data: { endedAt: now },
				});
				totalEnded += ids.length;
				console.info(
					`Ended ${ids.length} staffing session(s) older than ${staffingHours} hours.`,
				);

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
									timeoutHours: staffingHours,
								},
							});
						} catch (error) {
							console.error(
								`Failed to queue email for user ${session.userId}:`,
								error,
							);
						}
					}
				}
			}
		}

		if (totalEnded > 0) {
			console.info(`Total sessions ended: ${totalEnded}`);
		}
	} catch (err) {
		console.error("endOldSessions error:", err);
		throw err;
	}
}

export const endOldSessionsJob = new CronJob("*/1 * * * *", endOldSessions);
