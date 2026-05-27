import type { WorkerDefinition } from "@ecehive/core";
import { processAutoTurnOff } from "@ecehive/features";
import { getLogger } from "@ecehive/logger";
import { CronJob } from "cron";

const logger = getLogger("plugin:control:auto-turn-off-control-points");

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

const cronJob = new CronJob("* * * * *", autoTurnOffControlPoints);

export const autoTurnOffControlPointsWorker: WorkerDefinition = {
	name: "control:auto-turn-off-control-points",
	start() {
		cronJob.start();
	},
	stop() {
		cronJob.stop();
	},
};
