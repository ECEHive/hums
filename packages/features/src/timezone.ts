import { env } from "@ecehive/env";
import { Temporal } from "@js-temporal/polyfill";

export const APP_TIME_ZONE = env.TZ;
const MIDNIGHT = new Temporal.PlainTime(0, 0, 0);

export function instantFromDate(date: Date): Temporal.Instant {
	return Temporal.Instant.from(date.toISOString());
}

export function zonedDateTimeFromDate(date: Date): Temporal.ZonedDateTime {
	return instantFromDate(date).toZonedDateTimeISO(APP_TIME_ZONE);
}

export function plainDateFromDate(date: Date): Temporal.PlainDate {
	return zonedDateTimeFromDate(date).toPlainDate();
}

export function plainDateToDate(date: Temporal.PlainDate): Date {
	return zonedDateTimeToDate(zonedDateTimeFor(date, MIDNIGHT));
}

export function zonedDateTimeFor(
	date: Temporal.PlainDate,
	time: Temporal.PlainTime,
): Temporal.ZonedDateTime {
	return Temporal.ZonedDateTime.from({
		timeZone: APP_TIME_ZONE,
		year: date.year,
		month: date.month,
		day: date.day,
		hour: time.hour,
		minute: time.minute,
		second: time.second,
		millisecond: 0,
		microsecond: 0,
		nanosecond: 0,
	});
}

export function zonedDateTimeToDate(zdt: Temporal.ZonedDateTime): Date {
	return new Date(zdt.epochMilliseconds);
}

export function plainTimeFromString(timeString: string): Temporal.PlainTime {
	const [hourPart, minutePart = "0", secondPart = "0"] = timeString
		.split(":")
		.map((segment) => segment.trim());

	const hours = Number(hourPart || 0);
	const minutes = Number(minutePart || 0);
	const seconds = Number(secondPart || 0);

	return new Temporal.PlainTime(hours, minutes, seconds);
}

export function zeroBasedToTemporalDayOfWeek(dayOfWeek: number): number {
	return dayOfWeek === 0 ? 7 : dayOfWeek;
}

export function temporalToZeroBasedDayOfWeek(dayOfWeek: number): number {
	return dayOfWeek === 7 ? 0 : dayOfWeek;
}
