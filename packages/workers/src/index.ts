import { updateShiftAttendanceJob } from "./jobs/update-shift-attendance";

export function start() {
	updateShiftAttendanceJob.start();
}
