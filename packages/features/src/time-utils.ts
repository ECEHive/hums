import { env } from "@ecehive/env";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { parseTimeString } from "./shift-schedules/utils";

dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Compute the end timestamp of a shift occurrence in the configured timezone.
 * Handles shifts that wrap to the next day.
 */
export function computeOccurrenceEnd(
	start: Date,
	startTime: string,
	endTime: string,
): Date {
	const startComponents = parseTimeString(startTime);
	const endComponents = parseTimeString(endTime);

	// Convert start to the configured timezone and build an end date using the same day
	const tzStart = dayjs(start).tz(env.TZ);

	let tzEnd = tzStart
		.hour(endComponents.hours)
		.minute(endComponents.minutes)
		.second(endComponents.seconds || 0)
		.millisecond(0);

	// If end time is earlier than or equal to start time, the shift wraps to the next day
	if (
		endComponents.hours < startComponents.hours ||
		(endComponents.hours === startComponents.hours &&
			endComponents.minutes <= startComponents.minutes)
	) {
		tzEnd = tzEnd.add(1, "day");
	}

	return tzEnd.toDate();
}
