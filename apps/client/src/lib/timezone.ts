import dayjsLib, { type Dayjs } from "dayjs";
import advancedFormat from "dayjs/plugin/advancedFormat";
import localizedFormat from "dayjs/plugin/localizedFormat";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

// Configure dayjs with the plugins we rely on throughout the client.
dayjsLib.extend(utc);
dayjsLib.extend(timezone);
dayjsLib.extend(localizedFormat);
dayjsLib.extend(advancedFormat);

export type DateInput = Date | string | number | Dayjs;

export const APP_TZ = import.meta.env.TZ || "America/New_York";
export const USER_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
export const isUserInAppTimezone = APP_TZ === USER_TZ;

const DEFAULT_DATE_TIME_FORMAT = "MMM D, YYYY h:mm A";
const DEFAULT_DATE_FORMAT = "MMM D, YYYY";
const DEFAULT_TIME_FORMAT = "h:mm A";

const tzFormatterCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(timeZone: string) {
	if (!tzFormatterCache.has(timeZone)) {
		tzFormatterCache.set(
			timeZone,
			new Intl.DateTimeFormat("en-US", {
				timeZone,
				timeZoneName: "short",
			}),
		);
	}

	const formatter = tzFormatterCache.get(timeZone);
	if (!formatter) {
		throw new Error(`Timezone formatter missing for ${timeZone}`);
	}
	return formatter;
}

function getAbbreviation(day: Dayjs) {
	return (
		getFormatter(APP_TZ)
			.formatToParts(day.toDate())
			.find((part) => part.type === "timeZoneName")?.value ?? APP_TZ
	);
}

function toAppDayjs(
	value: DateInput,
	options?: { treatAsLocalInput?: boolean },
) {
	if (dayjsLib.isDayjs(value)) {
		return options?.treatAsLocalInput
			? value.tz(APP_TZ, true)
			: value.tz(APP_TZ);
	}

	const instance = dayjsLib(value);
	return options?.treatAsLocalInput
		? instance.tz(APP_TZ, true)
		: instance.tz(APP_TZ);
}

function shouldAnnotateTimezone(include?: boolean) {
	return (include ?? true) && !isUserInAppTimezone;
}

export function getAppTimezoneAbbreviation(
	date?: DateInput,
	options?: { treatAsLocalInput?: boolean },
) {
	const source = date
		? toAppDayjs(date, { treatAsLocalInput: options?.treatAsLocalInput })
		: dayjsLib().tz(APP_TZ);
	return getAbbreviation(source);
}

export function formatInAppTimezone(
	value: DateInput,
	options?: {
		formatString?: string;
		includeTimezoneWhenDifferent?: boolean;
		treatAsLocalInput?: boolean;
	},
) {
	const formatString = options?.formatString ?? DEFAULT_DATE_TIME_FORMAT;
	const day = toAppDayjs(value, {
		treatAsLocalInput: options?.treatAsLocalInput,
	});
	let formatted = day.format(formatString);

	if (shouldAnnotateTimezone(options?.includeTimezoneWhenDifferent)) {
		formatted = `${formatted} ${getAbbreviation(day)}`;
	}

	return formatted;
}

export function formatDateInAppTimezone(
	value: DateInput,
	options?: {
		formatString?: string;
		includeTimezoneWhenDifferent?: boolean;
		treatAsLocalInput?: boolean;
	},
) {
	return formatInAppTimezone(value, {
		formatString: options?.formatString ?? DEFAULT_DATE_FORMAT,
		includeTimezoneWhenDifferent:
			options?.includeTimezoneWhenDifferent ?? false,
		treatAsLocalInput: options?.treatAsLocalInput,
	});
}

export function formatTimeInAppTimezone(
	value: DateInput,
	options?: {
		formatString?: string;
		includeTimezoneWhenDifferent?: boolean;
		treatAsLocalInput?: boolean;
	},
) {
	return formatInAppTimezone(value, {
		formatString: options?.formatString ?? DEFAULT_TIME_FORMAT,
		includeTimezoneWhenDifferent: options?.includeTimezoneWhenDifferent ?? true,
		treatAsLocalInput: options?.treatAsLocalInput,
	});
}

export function formatLocalInput(
	value: Date | null | undefined,
	options?: { formatString?: string; includeTimezoneWhenDifferent?: boolean },
) {
	if (!value) return "";

	return formatInAppTimezone(value, {
		formatString: options?.formatString,
		includeTimezoneWhenDifferent: options?.includeTimezoneWhenDifferent ?? true,
		treatAsLocalInput: true,
	});
}

export function toUtcDateFromLocalInput(value?: Date | null) {
	if (!value) return null;
	return toAppDayjs(value, { treatAsLocalInput: true }).utc().toDate();
}

export function formatTimeString(
	time: string,
	options?: { includeTimezoneWhenDifferent?: boolean },
) {
	if (!time) return "";
	const [hourPart, minutePart = "0"] = time.split(":");
	const hours24 = Number(hourPart);
	const minutes = Number(minutePart);
	const period = hours24 >= 12 ? "PM" : "AM";
	const displayHours = hours24 % 12 || 12;
	const formatted = `${displayHours}:${minutes
		.toString()
		.padStart(2, "0")} ${period}`;

	if (shouldAnnotateTimezone(options?.includeTimezoneWhenDifferent)) {
		return `${formatted} ${getAppTimezoneAbbreviation()}`;
	}

	return formatted;
}

export function formatTimeRange(
	start: string,
	end: string,
	options?: { includeTimezoneWhenDifferent?: boolean },
) {
	const includeTimezone = options?.includeTimezoneWhenDifferent ?? true;
	const startLabel = formatTimeString(start, {
		includeTimezoneWhenDifferent: false,
	});
	const endLabel = formatTimeString(end, {
		includeTimezoneWhenDifferent: false,
	});
	const combined = `${startLabel} - ${endLabel}`;

	if (shouldAnnotateTimezone(includeTimezone)) {
		return `${combined} ${getAppTimezoneAbbreviation()}`;
	}

	return combined;
}

export function formatLocalRange(
	start?: Date | null,
	end?: Date | null,
	options?: { includeTime?: boolean },
) {
	const formatString = options?.includeTime
		? DEFAULT_DATE_TIME_FORMAT
		: DEFAULT_DATE_FORMAT;
	const startLabel = start
		? formatLocalInput(start, {
				formatString,
				includeTimezoneWhenDifferent: options?.includeTime,
			})
		: null;
	const endLabel = end
		? formatLocalInput(end, {
				formatString,
				includeTimezoneWhenDifferent: options?.includeTime,
			})
		: null;

	if (startLabel && endLabel) {
		return `${startLabel} → ${endLabel}`;
	}

	return startLabel ?? endLabel ?? "";
}

export function getAppTimezoneDisplayLabel() {
	return `${getAppTimezoneAbbreviation()} (${APP_TZ})`;
}

export { dayjsLib as dayjs };
