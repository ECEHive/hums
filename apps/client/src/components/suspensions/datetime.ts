import { dayjs, getAppTimezone } from "@/lib/timezone";

const DATE_FORMAT = "YYYY-MM-DD";
const TIME_FORMAT = "HH:mm:ss";

/**
 * Format a Date object to a date string in the app timezone for the date picker.
 */
export function formatDateForInput(value?: Date | null): string {
	if (!value) return "";
	const appTz = getAppTimezone();
	return dayjs(value).tz(appTz).format(DATE_FORMAT);
}

/**
 * Format a Date object to a time string in the app timezone for the time picker.
 */
export function formatTimeForInput(value?: Date | null): string {
	if (!value) return "";
	const appTz = getAppTimezone();
	return dayjs(value).tz(appTz).format(TIME_FORMAT);
}

/**
 * Parse a date string and time string into a Date object, treating the input
 * as being in the app timezone.
 */
export function parseDateTimeInput(
	dateStr: string,
	timeStr: string,
): Date | null {
	if (!dateStr || !timeStr) return null;
	const appTz = getAppTimezone();
	const combined = `${dateStr}T${timeStr}`;
	const parsed = dayjs.tz(combined, appTz);
	return parsed.isValid() ? parsed.toDate() : null;
}
