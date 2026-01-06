import { dayjs, getAppTimezone } from "@/lib/timezone";

const INPUT_FORMAT = "YYYY-MM-DDTHH:mm";

export function formatDateTimeInput(value?: Date | null) {
	if (!value) return "";
	const appTz = getAppTimezone();
	return dayjs(value).tz(appTz).format(INPUT_FORMAT);
}

export function parseDateTimeInput(value: string) {
	if (!value) return null;
	const appTz = getAppTimezone();
	const parsed = dayjs.tz(value, INPUT_FORMAT, appTz);
	return parsed.isValid() ? parsed.toDate() : null;
}
