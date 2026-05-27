import { getLogger } from "@ecehive/logger";
import { cleanupExpiredCodesJob } from "./jobs/cleanup-expired-codes";
import { sendSuspensionNoticesJob } from "./jobs/send-suspension-notices";

const logger = getLogger("workers");

export function start() {
	cleanupExpiredCodesJob.start();
	sendSuspensionNoticesJob.start();
	logger.info("Background workers initialized", {
		jobs: ["cleanupExpiredCodes", "sendSuspensionNotices"],
	});
}
