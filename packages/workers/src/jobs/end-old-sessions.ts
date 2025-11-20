import { prisma } from "@ecehive/prisma";
import { CronJob } from "cron";

/**
 * Ends all active sessions (endedAt == null) that started more than 12 hours ago.
 * Runs hourly.
 */
export async function endOldSessions(): Promise<void> {
	try {
		const now = new Date();
		const cutoff = new Date(now.getTime() - 12 * 60 * 60 * 1000); // 12 hours

		// Find active sessions started before cutoff
		const sessions = await prisma.session.findMany({
			where: {
				endedAt: null,
				startedAt: { lt: cutoff },
			},
			select: { id: true, startedAt: true },
		});

		if (sessions.length === 0) return;

		// Bulk update: set endedAt to now for matched sessions
		const ids = sessions.map((s) => s.id);

		await prisma.session.updateMany({
			where: { id: { in: ids }, endedAt: null },
			data: { endedAt: now },
		});

		console.info(`Ended ${ids.length} stale session(s) older than 12 hours.`);
	} catch (err) {
		console.error("endOldSessions error:", err);
		throw err;
	}
}

export const endOldSessionsJob = new CronJob("0 * * * *", endOldSessions);
