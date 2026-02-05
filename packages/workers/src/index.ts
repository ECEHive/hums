import { getLogger } from "@ecehive/logger";
import { autoTurnOffControlPointsJob } from "./jobs/auto-turn-off-control-points";
import { cleanupExpiredCodesJob } from "./jobs/cleanup-expired-codes";
import { endOldSessionsJob } from "./jobs/end-old-sessions";
import { sendSuspensionNoticesJob } from "./jobs/send-suspension-notices";
import { updateShiftAttendanceJob } from "./jobs/update-shift-attendance";

const logger = getLogger("workers");

export function start() {
	updateShiftAttendanceJob.start();
	endOldSessionsJob.start();
	cleanupExpiredCodesJob.start();
	sendSuspensionNoticesJob.start();
	autoTurnOffControlPointsJob.start();
	logger.info("Background workers initialized", {
		jobs: [
			"updateShiftAttendance",
			"endOldSessions",
			"cleanupExpiredCodes",
			"sendSuspensionNotices",
			"autoTurnOffControlPoints",
		],
	});
}
