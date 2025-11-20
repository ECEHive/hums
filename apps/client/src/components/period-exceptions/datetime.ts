import { APP_TZ, dayjs } from "@/lib/timezone";

const INPUT_FORMAT = "YYYY-MM-DDTHH:mm";

export function formatDateTimeInput(value?: Date | null) {
	if (!value) return "";
	return dayjs(value).tz(APP_TZ).format(INPUT_FORMAT);
}

export function parseDateTimeInput(value: string) {
	if (!value) return null;
	const parsed = dayjs.tz(value, INPUT_FORMAT, APP_TZ);
	return parsed.isValid() ? parsed.toDate() : null;
}
