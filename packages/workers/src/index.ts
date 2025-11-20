import { endOldSessionsJob } from "./jobs/end-old-sessions";
import { updateShiftAttendanceJob } from "./jobs/update-shift-attendance";

export function start() {
	updateShiftAttendanceJob.start();
	endOldSessionsJob.start();
}
