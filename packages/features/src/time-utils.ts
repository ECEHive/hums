import {
	plainTimeFromString as toPlainTime,
	zonedDateTimeFor,
	zonedDateTimeFromDate,
	zonedDateTimeToDate,
} from "./timezone";

export const ATTENDANCE_GRACE_MINUTES = 5;
const MINUTE_IN_MS = 60 * 1000;

/**
 * Compute the end timestamp of a shift occurrence in the configured timezone.
 * Handles shifts that wrap to the next day.
 */
export function computeOccurrenceEnd(
	start: Date,
	startTime: string,
	endTime: string,
): Date {
	const zonedStart = zonedDateTimeFromDate(start);
	const startDay = zonedStart.toPlainDate();
	const scheduledStart = zonedDateTimeFor(startDay, toPlainTime(startTime));
	let scheduledEnd = zonedDateTimeFor(startDay, toPlainTime(endTime));

	if (scheduledEnd.epochMilliseconds <= scheduledStart.epochMilliseconds) {
		scheduledEnd = scheduledEnd.add({ days: 1 });
	}

	return zonedDateTimeToDate(scheduledEnd);
}

/**
 * Compute the scheduled start timestamp of a shift occurrence based on its date and start time.
 */
export function computeOccurrenceStart(
	timestamp: Date,
	startTime: string,
): Date {
	const zonedTimestamp = zonedDateTimeFromDate(timestamp);
	const scheduledStart = zonedDateTimeFor(
		zonedTimestamp.toPlainDate(),
		toPlainTime(startTime),
	);
	return zonedDateTimeToDate(scheduledStart);
}

export function isArrivalLate(
	scheduledStart: Date,
	actualTimeIn: Date | null | undefined,
	graceMinutes = ATTENDANCE_GRACE_MINUTES,
): boolean {
	if (!actualTimeIn) return false;
	const graceMs = graceMinutes * MINUTE_IN_MS;
	return actualTimeIn.getTime() - scheduledStart.getTime() > graceMs;
}

export function isDepartureEarly(
	scheduledEnd: Date,
	actualTimeOut: Date | null | undefined,
	graceMinutes = ATTENDANCE_GRACE_MINUTES,
): boolean {
	if (!actualTimeOut) return false;
	const graceMs = graceMinutes * MINUTE_IN_MS;
	return scheduledEnd.getTime() - actualTimeOut.getTime() > graceMs;
}
