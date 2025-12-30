import { ConfigService } from "@ecehive/features";
import { prisma } from "@ecehive/prisma";
import { CronJob } from "cron";

/**
 * Ends all active sessions (endedAt == null) that started more than the configured timeout ago.
 * Separate timeouts for regular and staffing sessions.
 * Runs every 5 minutes.
 */
export async function endOldSessions(): Promise<void> {
	try {
		const now = new Date();

        // Get configuration values in a single batched request
		const configValues = await ConfigService.getMany([
			"session.timeout.regular.enabled",
			"session.timeout.regular.hours",
			"session.timeout.staffing.enabled",
			"session.timeout.staffing.hours",
		]);
		const regularEnabled = configValues[
			"session.timeout.regular.enabled"
		] as boolean;
		const regularHours = configValues[
			"session.timeout.regular.hours"
		] as number;
		const staffingEnabled = configValues[
			"session.timeout.staffing.enabled"
		] as boolean;
		const staffingHours = configValues[
			"session.timeout.staffing.hours"
		] as number;

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
				select: { id: true },
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
				select: { id: true },
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

export const endOldSessionsJob = new CronJob("*/5 * * * *", endOldSessions);