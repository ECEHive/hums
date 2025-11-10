import { env } from "@ecehive/env";
import dayjs from "dayjs";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

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
export function findNextDayOfWeek(
	startDate: Date,
	targetDayOfWeek: number,
	endDate?: Date,
): Date | null {
	let current = dayjs(startDate).startOf("day");
	const end = endDate ? dayjs(endDate).endOf("day") : null;

	// Find the first occurrence of the target day of week
	while (current.day() !== targetDayOfWeek) {
		if (end && current.isAfter(end)) {
			return null;
		}
		current = current.add(1, "day");
	}

	return current.toDate();
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

	// Parse the start time (format: "HH:MM:SS")
	const { hours, minutes, seconds } = parseTimeString(startTime);

	// Start from the beginning of the period in the configured timezone
	let current = dayjs(periodStart).tz(env.TZ).startOf("day");
	const end = dayjs(periodEnd).tz(env.TZ).endOf("day");

	// Find the first occurrence of the target day of week
	while (current.day() !== dayOfWeek && current.isBefore(end)) {
		current = current.add(1, "day");
	}

	// Generate occurrences on the target day of week
	while (current.isBefore(end)) {
		// Set the time for this occurrence in the configured timezone
		const occurrence = current
			.hour(hours)
			.minute(minutes)
			.second(seconds)
			.millisecond(0);

		// Only add if it's within the period bounds
		if (
			occurrence.isSameOrAfter(periodStart) &&
			occurrence.isBefore(periodEnd)
		) {
			occurrences.push(occurrence.toDate());
		}

		// Move to next week
		current = current.add(7, "day");
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

	return timestamps.filter((timestamp) => {
		const ts = dayjs(timestamp);

		// Check if timestamp falls within any exception period
		for (const exception of exceptions) {
			const exceptionStart = dayjs(exception.start);
			const exceptionEnd = dayjs(exception.end);

			// If timestamp is within the exception period (inclusive), exclude it
			if (ts.isSameOrAfter(exceptionStart) && ts.isSameOrBefore(exceptionEnd)) {
				return false;
			}
		}

		return true;
	});
}
