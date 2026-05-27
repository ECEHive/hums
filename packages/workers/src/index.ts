import { getLogger } from "@ecehive/logger";
import { autoTurnOffControlPointsJob } from "./jobs/auto-turn-off-control-points";
import { cleanupExpiredCodesJob } from "./jobs/cleanup-expired-codes";
import { sendSuspensionNoticesJob } from "./jobs/send-suspension-notices";
import { updateShiftAttendanceJob } from "./jobs/update-shift-attendance";

const logger = getLogger("workers");

export function start() {
	updateShiftAttendanceJob.start();
	cleanupExpiredCodesJob.start();
	sendSuspensionNoticesJob.start();
	autoTurnOffControlPointsJob.start();
	logger.info("Background workers initialized", {
		jobs: [
			"updateShiftAttendance",
			"cleanupExpiredCodes",
			"sendSuspensionNotices",
			"autoTurnOffControlPoints",
		],
	});
}
