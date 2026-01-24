import { Temporal } from "@js-temporal/polyfill";
import {
	instantFromDate,
	plainDateFromDate,
	plainDateToDate,
	plainTimeFromString as toPlainTime,
	zeroBasedToTemporalDayOfWeek,
	zonedDateTimeFor,
	zonedDateTimeToDate,
} from "../timezone";

const MINUTES_PER_DAY = 24 * 60;
const MINUTES_PER_HOUR = 60;

/**
 * Parse a time string in HH:MM:SS format.
 *
 * @param timeString - The time string to parse (e.g., "09:30:00")
 * @returns An object with hours, minutes, and seconds
 */
export function parseTimeString(timeString: string): {
	hours: number;
	minutes: number;
	seconds: number;
} {
	const [hours, minutes, seconds] = timeString.split(":").map(Number);
	return {
		hours,
		minutes,
		seconds: seconds || 0,
	};
}

/**
 * Find the next occurrence of a specific day of week starting from a given date.
 *
 * @param startDate - The date to start searching from
 * @param targetDayOfWeek - The target day of week (0 = Sunday, 6 = Saturday)
 * @param endDate - Optional end date to stop searching
 * @returns The date of the next occurrence, or null if not found before endDate
 */
function getNextMatchingPlainDate(
	startDate: Date,
	targetDayOfWeek: number,
	endDate?: Date,
): Temporal.PlainDate | null {
	const target = zeroBasedToTemporalDayOfWeek(targetDayOfWeek);
	let current = plainDateFromDate(startDate);
	const boundary = endDate ? plainDateFromDate(endDate) : null;

	while (current.dayOfWeek !== target) {
		if (boundary && Temporal.PlainDate.compare(current, boundary) > 0) {
			return null;
		}
		current = current.add({ days: 1 });
	}

	return current;
}

export function findNextDayOfWeek(
	startDate: Date,
	targetDayOfWeek: number,
	endDate?: Date,
): Date | null {
	const next = getNextMatchingPlainDate(startDate, targetDayOfWeek, endDate);
	return next ? plainDateToDate(next) : null;
}

/**
 * Generate all occurrence timestamps for a shift schedule within a period.
 *
 * @param periodStart - The start timestamp of the period
 * @param periodEnd - The end timestamp of the period
 * @param dayOfWeek - The day of week for the shift (0 = Sunday, 6 = Saturday)
 * @param startTime - The start time of the shift (HH:MM:SS format)
 * @returns Array of Date objects representing each occurrence
 */
export function generateOccurrenceTimestamps(
	periodStart: Date,
	periodEnd: Date,
	dayOfWeek: number,
	startTime: string,
): Date[] {
	const occurrences: Date[] = [];
	const firstDate = getNextMatchingPlainDate(periodStart, dayOfWeek, periodEnd);

	if (!firstDate) {
		return occurrences;
	}

	const startInstant = instantFromDate(periodStart);
	const endInstant = instantFromDate(periodEnd);
	const terminalDate = plainDateFromDate(periodEnd);
	const startPlainTime = toPlainTime(startTime);

	let cursor = firstDate;
	while (Temporal.PlainDate.compare(cursor, terminalDate) <= 0) {
		const zonedDateTime = zonedDateTimeFor(cursor, startPlainTime);
		const occurrenceInstant = zonedDateTime.toInstant();
		const isOnOrAfterStart =
			Temporal.Instant.compare(occurrenceInstant, startInstant) >= 0;
		const isBeforeEnd =
			Temporal.Instant.compare(occurrenceInstant, endInstant) < 0;

		if (isOnOrAfterStart && isBeforeEnd) {
			occurrences.push(zonedDateTimeToDate(zonedDateTime));
		}

		cursor = cursor.add({ days: 7 });
	}

	return occurrences;
}

/**
 * Compare two sets of timestamps and determine which should be created and deleted.
 *
 * @param expectedTimestamps - Array of timestamps that should exist
 * @param existingTimestamps - Array of timestamps that currently exist
 * @returns Object containing timestamps to create and timestamps to delete
 */
export function compareTimestamps(
	expectedTimestamps: Date[],
	existingTimestamps: Date[],
): {
	timestampsToCreate: Date[];
	timestampsToDelete: Date[];
} {
	const existingSet = new Set(existingTimestamps.map((ts) => ts.toISOString()));

	const expectedSet = new Set(expectedTimestamps.map((ts) => ts.toISOString()));

	const timestampsToCreate = expectedTimestamps.filter(
		(ts) => !existingSet.has(ts.toISOString()),
	);

	const timestampsToDelete = existingTimestamps.filter(
		(ts) => !expectedSet.has(ts.toISOString()),
	);

	return {
		timestampsToCreate,
		timestampsToDelete,
	};
}

/**
 * Filter out timestamps that are in the past.
 *
 * @param timestamps - Array of timestamps to filter
 * @param referenceTime - The reference time to compare against (defaults to now)
 * @returns Array of timestamps that are in the future (strictly after referenceTime)
 */
export function filterPastTimestamps(
	timestamps: Date[],
	referenceTime: Date = new Date(),
): Date[] {
	const referenceInstant = instantFromDate(referenceTime);

	return timestamps.filter((timestamp) => {
		const tsInstant = instantFromDate(timestamp);
		return Temporal.Instant.compare(tsInstant, referenceInstant) > 0;
	});
}

/**
 * Exception period for filtering occurrences.
 */
export interface ExceptionPeriod {
	start: Date;
	end: Date;
}

/**
 * Filter out timestamps that fall within exception periods.
 *
 * @param timestamps - Array of timestamps to filter
 * @param exceptions - Array of exception periods
 * @returns Array of timestamps that don't fall within any exception period
 */
export function filterExceptionPeriods(
	timestamps: Date[],
	exceptions: ExceptionPeriod[],
): Date[] {
	if (exceptions.length === 0) {
		return timestamps;
	}

	const exceptionWindows = exceptions.map((exception) => ({
		start: instantFromDate(exception.start),
		end: instantFromDate(exception.end),
	}));

	return timestamps.filter((timestamp) => {
		const tsInstant = instantFromDate(timestamp);
		return !exceptionWindows.some((window) => {
			const startsBeforeOrAt =
				Temporal.Instant.compare(tsInstant, window.start) >= 0;
			const endsAfterOrAt =
				Temporal.Instant.compare(tsInstant, window.end) <= 0;
			return startsBeforeOrAt && endsAfterOrAt;
		});
	});
}

export type RequirementUnit = "count" | "minutes" | "hours";

export interface RequirementScheduleLite {
	startTime: string;
	endTime: string;
}

/**
 * Calculate the duration of a shift schedule in minutes, handling overnight shifts.
 */
export function getShiftDurationMinutes(
	startTime: string,
	endTime: string,
): number {
	const start = parseTimeString(startTime);
	const end = parseTimeString(endTime);

	const startMinutes =
		start.hours * MINUTES_PER_HOUR +
		start.minutes +
		(start.seconds ?? 0) / MINUTES_PER_HOUR;
	let endMinutes =
		end.hours * MINUTES_PER_HOUR +
		end.minutes +
		(end.seconds ?? 0) / MINUTES_PER_HOUR;

	if (endMinutes <= startMinutes) {
		endMinutes += MINUTES_PER_DAY;
	}

	return endMinutes - startMinutes;
}

export function calculateRequirementComparableValue(
	schedules: RequirementScheduleLite[],
	unit: RequirementUnit,
): number {
	if (unit === "count") {
		return schedules.length;
	}

	return schedules.reduce(
		(total, schedule) =>
			total + getShiftDurationMinutes(schedule.startTime, schedule.endTime),
		0,
	);
}

export function convertRequirementThresholdToComparable(
	value: number,
	unit: RequirementUnit,
): number {
	if (unit === "count") {
		return value;
	}

	if (unit === "minutes") {
		return value;
	}

	return value * MINUTES_PER_HOUR;
}

export function convertComparableValueToUnit(
	value: number,
	unit: RequirementUnit,
): number {
	if (unit === "count") {
		return value;
	}

	if (unit === "minutes") {
		return value;
	}

	return value / MINUTES_PER_HOUR;
}
