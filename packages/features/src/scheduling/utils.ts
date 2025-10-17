import type { periods, shiftSchedules } from "@ecehive/drizzle";

const WEEK_IN_MS = 7 * 24 * 60 * 60 * 1000;
export const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;

export type ScheduleLike = Pick<
	typeof shiftSchedules.$inferSelect,
	"id" | "dayOfWeek" | "startTime"
>;

export type PeriodLike = Pick<
	typeof periods.$inferSelect,
	"id" | "start" | "end"
>;

export function generateOccurrenceTimestamps(options: {
	period: PeriodLike;
	schedule: ScheduleLike;
}): Date[] {
	const { period, schedule } = options;
	const { start: periodStart, end: periodEnd } = period;

	if (!periodStart || !periodEnd) {
		return [];
	}

	if (periodStart >= periodEnd) {
		return [];
	}

	const startTimeParts = parseTime(schedule.startTime);
	const occurrences: Date[] = [];

	const startDate = new Date(periodStart.getTime());
	const endDate = new Date(periodEnd.getTime());

	const startDay = startDate.getUTCDay();
	let dayOffset = schedule.dayOfWeek - startDay;
	if (dayOffset < 0) {
		dayOffset += 7;
	}

	const firstOccurrenceDate = new Date(
		Date.UTC(
			startDate.getUTCFullYear(),
			startDate.getUTCMonth(),
			startDate.getUTCDate(),
			0,
			0,
			0,
		),
	);
	firstOccurrenceDate.setUTCDate(firstOccurrenceDate.getUTCDate() + dayOffset);

	let current = combineDateAndTime(firstOccurrenceDate, startTimeParts);

	if (current < periodStart) {
		current = new Date(current.getTime() + WEEK_IN_MS);
	}

	while (current < endDate) {
		occurrences.push(new Date(current.getTime()));
		current = new Date(current.getTime() + WEEK_IN_MS);
	}

	return occurrences;
}

export function parseTime(time: string) {
	const match = TIME_REGEX.exec(time);

	if (!match) {
		throw new Error(`Invalid time format: ${time}`);
	}

	const hours = Number.parseInt(match[1] ?? "0", 10);
	const minutes = Number.parseInt(match[2] ?? "0", 10);
	const seconds = Number.parseInt(match[3] ?? "0", 10);

	return { hours, minutes, seconds };
}

function combineDateAndTime(
	date: Date,
	time: ReturnType<typeof parseTime>,
): Date {
	return new Date(
		Date.UTC(
			date.getUTCFullYear(),
			date.getUTCMonth(),
			date.getUTCDate(),
			time.hours,
			time.minutes,
			time.seconds,
		),
	);
}
