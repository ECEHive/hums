import { processAutoTurnOff } from "@ecehive/features";
import { getLogger } from "@ecehive/logger";
import { CronJob } from "cron";

const logger = getLogger("workers:auto-turn-off-control-points");

/**
 * Automatically turns off control points that have been on for longer
 * than their configured auto turn-off duration.
 *
 * This job:
 * 1. Finds all control points with auto turn-off enabled
 * 2. Checks if they've been on longer than their configured duration
 * 3. Turns them off and logs the action using the username of the user
 *    who originally turned them on
 *
 * Runs every minute.
 */
export async function autoTurnOffControlPoints(): Promise<void> {
	try {
		const results = await processAutoTurnOff();

		if (results.length > 0) {
			const successful = results.filter((r) => r.success);
			const failed = results.filter((r) => !r.success);

			if (successful.length > 0) {
				logger.info("Auto turned off control points", {
					count: successful.length,
					points: successful.map((r) => ({
						id: r.pointId,
						name: r.pointName,
						username: r.username,
					})),
				});
			}

			if (failed.length > 0) {
				logger.warn("Failed to auto turn off some control points", {
					count: failed.length,
					failures: failed.map((r) => ({
						id: r.pointId,
						name: r.pointName,
						error: r.errorMessage,
					})),
				});
			}
		}
	} catch (err) {
		logger.error("Failed to process auto turn-off", {
			error: err instanceof Error ? err.message : String(err),
		});
		throw err;
	}
}

// Run every minute
export const autoTurnOffControlPointsJob = new CronJob(
	"* * * * *",
	autoTurnOffControlPoints,
);
