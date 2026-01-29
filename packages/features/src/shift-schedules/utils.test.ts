import { Temporal } from "@js-temporal/polyfill";
import { describe, expect, it } from "vitest";
import { APP_TIME_ZONE } from "../timezone";
import {
	compareTimestamps,
	filterExceptionPeriods,
	filterPastTimestamps,
	findNextDayOfWeek,
	generateOccurrenceTimestamps,
	parseTimeString,
} from "./utils";

const TEST_TIME_ZONE = APP_TIME_ZONE;

function zonedDate(
	year: number,
	month: number,
	day: number,
	hour = 0,
	minute = 0,
	second = 0,
) {
	return new Date(
		Temporal.ZonedDateTime.from({
			timeZone: TEST_TIME_ZONE,
			year,
			month,
			day,
			hour,
			minute,
			second,
		}).epochMilliseconds,
	);
}

describe("parseTimeString", () => {
	it("should parse a full time string with hours, minutes, and seconds", () => {
		const result = parseTimeString("09:30:45");
		expect(result).toEqual({
			hours: 9,
			minutes: 30,
			seconds: 45,
		});
	});

	it("should parse a time string with leading zeros", () => {
		const result = parseTimeString("00:00:00");
		expect(result).toEqual({
			hours: 0,
			minutes: 0,
			seconds: 0,
		});
	});

	it("should parse a time string at midnight", () => {
		const result = parseTimeString("23:59:59");
		expect(result).toEqual({
			hours: 23,
			minutes: 59,
			seconds: 59,
		});
	});

	it("should handle time string without seconds (defaults to 0)", () => {
		const result = parseTimeString("14:30:");
		expect(result).toEqual({
			hours: 14,
			minutes: 30,
			seconds: 0,
		});
	});
});

describe("findNextDayOfWeek", () => {
	it("should find the next Monday when starting on a Monday", () => {
		const startDate = zonedDate(2024, 1, 1);
		const result = findNextDayOfWeek(startDate, 1); // 1 = Monday

		expect(result).not.toBeNull();
		expect(result?.getUTCDay()).toBe(1); // Monday
		expect(result?.toISOString()).toBe(zonedDate(2024, 1, 1).toISOString());
	});

	it("should find the next Friday when starting on a Monday", () => {
		const startDate = zonedDate(2024, 1, 1);
		const result = findNextDayOfWeek(startDate, 5); // 5 = Friday

		expect(result).not.toBeNull();
		expect(result?.getUTCDay()).toBe(5); // Friday
		expect(result?.toISOString()).toBe(zonedDate(2024, 1, 5).toISOString());
	});

	it("should find the next Sunday when starting on Saturday", () => {
		const startDate = zonedDate(2024, 1, 6);
		const result = findNextDayOfWeek(startDate, 0); // 0 = Sunday

		expect(result).not.toBeNull();
		expect(result?.getUTCDay()).toBe(0); // Sunday
		expect(result?.toISOString()).toBe(zonedDate(2024, 1, 7).toISOString());
	});

	it("should return null if target day is not found before end date", () => {
		const startDate = zonedDate(2024, 1, 1);
		const endDate = zonedDate(2024, 1, 2);
		const result = findNextDayOfWeek(startDate, 5, endDate);

		expect(result).toBeNull();
	});

	it("should find the day within the end date boundary", () => {
		const startDate = zonedDate(2024, 1, 1);
		const endDate = zonedDate(2024, 1, 5, 23, 59, 59);
		const result = findNextDayOfWeek(startDate, 5, endDate);

		expect(result).not.toBeNull();
		expect(result?.getUTCDay()).toBe(5);
	});
});

describe("generateOccurrenceTimestamps", () => {
	it("should generate weekly occurrences for a month-long period", () => {
		const periodStart = zonedDate(2024, 1, 1);
		const periodEnd = zonedDate(2024, 1, 31, 23, 59, 59);
		const dayOfWeek = 1; // Monday
		const startTime = "09:00:00";

		const occurrences = generateOccurrenceTimestamps(
			periodStart,
			periodEnd,
			dayOfWeek,
			startTime,
		);

		expect(occurrences).toHaveLength(5);

		expect(occurrences[0].toISOString()).toBe(
			zonedDate(2024, 1, 1, 9).toISOString(),
		);
		expect(occurrences[4].toISOString()).toBe(
			zonedDate(2024, 1, 29, 9).toISOString(),
		);

		// All should be Mondays
		occurrences.forEach((date) => {
			expect(date.getUTCDay()).toBe(1);
		});
	});

	it("should generate occurrences starting mid-week", () => {
		const periodStart = zonedDate(2024, 1, 3);
		const periodEnd = zonedDate(2024, 1, 31, 23, 59, 59);
		const dayOfWeek = 1; // Monday
		const startTime = "14:30:00";

		const occurrences = generateOccurrenceTimestamps(
			periodStart,
			periodEnd,
			dayOfWeek,
			startTime,
		);

		expect(occurrences).toHaveLength(4);

		expect(occurrences[0].toISOString()).toBe(
			zonedDate(2024, 1, 8, 14, 30).toISOString(),
		);
	});

	it("should generate no occurrences if day of week doesn't occur in period", () => {
		const periodStart = zonedDate(2024, 1, 1);
		const periodEnd = zonedDate(2024, 1, 2, 23, 59, 59);

		// Looking for Friday
		const dayOfWeek = 5; // Friday
		const startTime = "10:00:00";

		const occurrences = generateOccurrenceTimestamps(
			periodStart,
			periodEnd,
			dayOfWeek,
			startTime,
		);

		expect(occurrences).toHaveLength(0);
	});

	it("should handle occurrences at different times of day", () => {
		const periodStart = zonedDate(2024, 1, 1);
		const periodEnd = zonedDate(2024, 1, 31, 23, 59, 59);

		// Every Monday at 23:45:30
		const dayOfWeek = 1; // Monday
		const startTime = "23:45:30";

		const occurrences = generateOccurrenceTimestamps(
			periodStart,
			periodEnd,
			dayOfWeek,
			startTime,
		);

		expect(occurrences).toHaveLength(5);

		occurrences.forEach((date, index) => {
			const monday = 1 + index * 7;
			expect(date.toISOString()).toBe(
				zonedDate(2024, 1, monday, 23, 45, 30).toISOString(),
			);
		});
	});

	it("should handle Sunday as day of week (0)", () => {
		const periodStart = zonedDate(2024, 1, 1);
		const periodEnd = zonedDate(2024, 1, 31, 23, 59, 59);

		// Every Sunday at 08:00:00
		const dayOfWeek = 0; // Sunday
		const startTime = "08:00:00";

		const occurrences = generateOccurrenceTimestamps(
			periodStart,
			periodEnd,
			dayOfWeek,
			startTime,
		);

		expect(occurrences).toHaveLength(4);

		occurrences.forEach((date, index) => {
			const sunday = 7 + index * 7;
			expect(date.toISOString()).toBe(
				zonedDate(2024, 1, sunday, 8).toISOString(),
			);
		});
	});

	it("should exclude occurrences that fall exactly on period end", () => {
		const periodStart = zonedDate(2024, 1, 1, 9);
		const periodEnd = zonedDate(2024, 1, 8, 9);

		// Every Monday at 9:00 AM
		const dayOfWeek = 1; // Monday
		const startTime = "09:00:00";

		const occurrences = generateOccurrenceTimestamps(
			periodStart,
			periodEnd,
			dayOfWeek,
			startTime,
		);

		expect(occurrences).toHaveLength(1);
		expect(occurrences[0].toISOString()).toBe(
			zonedDate(2024, 1, 1, 9).toISOString(),
		);
	});

	it("should preserve wall time through spring DST shift", () => {
		const periodStart = zonedDate(2024, 3, 1);
		const periodEnd = zonedDate(2024, 3, 31, 23, 59, 59);
		const dayOfWeek = 0; // Sunday
		const startTime = "10:00:00";

		const occurrences = generateOccurrenceTimestamps(
			periodStart,
			periodEnd,
			dayOfWeek,
			startTime,
		);

		const beforeDst = occurrences.find((date) =>
			date.toISOString().startsWith("2024-03-03"),
		);
		const afterDst = occurrences.find((date) =>
			date.toISOString().startsWith("2024-03-10"),
		);

		expect(beforeDst?.toISOString()).toBe(
			zonedDate(2024, 3, 3, 10).toISOString(),
		);
		expect(afterDst?.toISOString()).toBe(
			zonedDate(2024, 3, 10, 10).toISOString(),
		);
	});

	it("should preserve wall time through fall DST shift", () => {
		const periodStart = zonedDate(2024, 10, 1);
		const periodEnd = zonedDate(2024, 11, 30, 23, 59, 59);
		const dayOfWeek = 0; // Sunday
		const startTime = "10:00:00";

		const occurrences = generateOccurrenceTimestamps(
			periodStart,
			periodEnd,
			dayOfWeek,
			startTime,
		);

		const beforeDst = occurrences.find((date) =>
			date.toISOString().startsWith("2024-10-27"),
		);
		const afterDst = occurrences.find((date) =>
			date.toISOString().startsWith("2024-11-03"),
		);

		expect(beforeDst?.toISOString()).toBe(
			zonedDate(2024, 10, 27, 10).toISOString(),
		);
		expect(afterDst?.toISOString()).toBe(
			zonedDate(2024, 11, 3, 10).toISOString(),
		);
	});
});

describe("compareTimestamps", () => {
	it("should identify timestamps to create when expected has more", () => {
		const expected = [
			new Date("2024-01-01T09:00:00Z"),
			new Date("2024-01-08T09:00:00Z"),
			new Date("2024-01-15T09:00:00Z"),
		];

		const existing = [new Date("2024-01-01T09:00:00Z")];

		const result = compareTimestamps(expected, existing);

		expect(result.timestampsToCreate).toHaveLength(2);
		expect(result.timestampsToDelete).toHaveLength(0);

		expect(result.timestampsToCreate[0].toISOString()).toBe(
			"2024-01-08T09:00:00.000Z",
		);
		expect(result.timestampsToCreate[1].toISOString()).toBe(
			"2024-01-15T09:00:00.000Z",
		);
	});

	it("should identify timestamps to delete when existing has more", () => {
		const expected = [new Date("2024-01-01T09:00:00Z")];

		const existing = [
			new Date("2024-01-01T09:00:00Z"),
			new Date("2024-01-08T09:00:00Z"),
			new Date("2024-01-15T09:00:00Z"),
		];

		const result = compareTimestamps(expected, existing);

		expect(result.timestampsToCreate).toHaveLength(0);
		expect(result.timestampsToDelete).toHaveLength(2);

		expect(result.timestampsToDelete[0].toISOString()).toBe(
			"2024-01-08T09:00:00.000Z",
		);
		expect(result.timestampsToDelete[1].toISOString()).toBe(
			"2024-01-15T09:00:00.000Z",
		);
	});

	it("should return empty arrays when timestamps match", () => {
		const expected = [
			new Date("2024-01-01T09:00:00Z"),
			new Date("2024-01-08T09:00:00Z"),
		];

		const existing = [
			new Date("2024-01-01T09:00:00Z"),
			new Date("2024-01-08T09:00:00Z"),
		];

		const result = compareTimestamps(expected, existing);

		expect(result.timestampsToCreate).toHaveLength(0);
		expect(result.timestampsToDelete).toHaveLength(0);
	});

	it("should handle completely different timestamp sets", () => {
		const expected = [
			new Date("2024-01-01T09:00:00Z"),
			new Date("2024-01-08T09:00:00Z"),
		];

		const existing = [
			new Date("2024-01-15T09:00:00Z"),
			new Date("2024-01-22T09:00:00Z"),
		];

		const result = compareTimestamps(expected, existing);

		expect(result.timestampsToCreate).toHaveLength(2);
		expect(result.timestampsToDelete).toHaveLength(2);

		// Expected timestamps should be created
		expect(result.timestampsToCreate.map((d) => d.toISOString())).toContain(
			"2024-01-01T09:00:00.000Z",
		);
		expect(result.timestampsToCreate.map((d) => d.toISOString())).toContain(
			"2024-01-08T09:00:00.000Z",
		);

		// Existing timestamps should be deleted
		expect(result.timestampsToDelete.map((d) => d.toISOString())).toContain(
			"2024-01-15T09:00:00.000Z",
		);
		expect(result.timestampsToDelete.map((d) => d.toISOString())).toContain(
			"2024-01-22T09:00:00.000Z",
		);
	});

	it("should handle empty arrays", () => {
		const result1 = compareTimestamps([], []);
		expect(result1.timestampsToCreate).toHaveLength(0);
		expect(result1.timestampsToDelete).toHaveLength(0);

		const expected = [new Date("2024-01-01T09:00:00Z")];
		const result2 = compareTimestamps(expected, []);
		expect(result2.timestampsToCreate).toHaveLength(1);
		expect(result2.timestampsToDelete).toHaveLength(0);

		const existing = [new Date("2024-01-01T09:00:00Z")];
		const result3 = compareTimestamps([], existing);
		expect(result3.timestampsToCreate).toHaveLength(0);
		expect(result3.timestampsToDelete).toHaveLength(1);
	});

	it("should correctly compare timestamps with milliseconds", () => {
		const expected = [
			new Date("2024-01-01T09:00:00.000Z"),
			new Date("2024-01-01T09:00:00.999Z"), // Different milliseconds
		];

		const existing = [new Date("2024-01-01T09:00:00.000Z")];

		const result = compareTimestamps(expected, existing);

		expect(result.timestampsToCreate).toHaveLength(1);
		expect(result.timestampsToDelete).toHaveLength(0);

		// The timestamp with different milliseconds should be created
		expect(result.timestampsToCreate[0].toISOString()).toBe(
			"2024-01-01T09:00:00.999Z",
		);
	});
});

describe("filterExceptionPeriods", () => {
	it("should return all timestamps when there are no exceptions", () => {
		const timestamps = [
			new Date("2024-01-01T09:00:00Z"),
			new Date("2024-01-08T09:00:00Z"),
			new Date("2024-01-15T09:00:00Z"),
		];

		const result = filterExceptionPeriods(timestamps, []);

		expect(result).toHaveLength(3);
		expect(result).toEqual(timestamps);
	});

	it("should filter out timestamps that fall within a single exception period", () => {
		const timestamps = [
			new Date("2024-01-01T09:00:00Z"),
			new Date("2024-01-08T09:00:00Z"), // Within exception
			new Date("2024-01-15T09:00:00Z"),
		];

		const exceptions = [
			{
				start: new Date("2024-01-07T00:00:00Z"),
				end: new Date("2024-01-10T23:59:59Z"),
			},
		];

		const result = filterExceptionPeriods(timestamps, exceptions);

		expect(result).toHaveLength(2);
		expect(result.map((d) => d.toISOString())).toEqual([
			"2024-01-01T09:00:00.000Z",
			"2024-01-15T09:00:00.000Z",
		]);
	});

	it("should filter out timestamps within multiple exception periods", () => {
		const timestamps = [
			new Date("2024-01-01T09:00:00Z"),
			new Date("2024-01-08T09:00:00Z"), // Within first exception
			new Date("2024-01-15T09:00:00Z"),
			new Date("2024-01-22T09:00:00Z"), // Within second exception
			new Date("2024-01-29T09:00:00Z"),
		];

		const exceptions = [
			{
				start: new Date("2024-01-07T00:00:00Z"),
				end: new Date("2024-01-09T23:59:59Z"),
			},
			{
				start: new Date("2024-01-21T00:00:00Z"),
				end: new Date("2024-01-23T23:59:59Z"),
			},
		];

		const result = filterExceptionPeriods(timestamps, exceptions);

		expect(result).toHaveLength(3);
		expect(result.map((d) => d.toISOString())).toEqual([
			"2024-01-01T09:00:00.000Z",
			"2024-01-15T09:00:00.000Z",
			"2024-01-29T09:00:00.000Z",
		]);
	});

	it("should filter timestamps at the exact start of exception period", () => {
		const timestamps = [
			new Date("2024-01-01T09:00:00Z"),
			new Date("2024-01-08T00:00:00Z"), // Exact start of exception
			new Date("2024-01-15T09:00:00Z"),
		];

		const exceptions = [
			{
				start: new Date("2024-01-08T00:00:00Z"),
				end: new Date("2024-01-10T23:59:59Z"),
			},
		];

		const result = filterExceptionPeriods(timestamps, exceptions);

		expect(result).toHaveLength(2);
		expect(result.map((d) => d.toISOString())).not.toContain(
			"2024-01-08T00:00:00.000Z",
		);
	});

	it("should filter timestamps at the exact end of exception period", () => {
		const timestamps = [
			new Date("2024-01-01T09:00:00Z"),
			new Date("2024-01-08T09:00:00Z"),
			new Date("2024-01-10T23:59:59Z"), // Exact end of exception
		];

		const exceptions = [
			{
				start: new Date("2024-01-08T00:00:00Z"),
				end: new Date("2024-01-10T23:59:59Z"),
			},
		];

		const result = filterExceptionPeriods(timestamps, exceptions);

		expect(result).toHaveLength(1);
		expect(result[0].toISOString()).toBe("2024-01-01T09:00:00.000Z");
	});

	it("should not filter timestamps just before exception period", () => {
		const timestamps = [
			new Date("2024-01-01T09:00:00Z"),
			new Date("2024-01-07T23:59:59Z"), // Just before exception
			new Date("2024-01-15T09:00:00Z"),
		];

		const exceptions = [
			{
				start: new Date("2024-01-08T00:00:00Z"),
				end: new Date("2024-01-10T23:59:59Z"),
			},
		];

		const result = filterExceptionPeriods(timestamps, exceptions);

		expect(result).toHaveLength(3);
		expect(result).toEqual(timestamps);
	});

	it("should not filter timestamps just after exception period", () => {
		const timestamps = [
			new Date("2024-01-01T09:00:00Z"),
			new Date("2024-01-11T00:00:00Z"), // Just after exception
			new Date("2024-01-15T09:00:00Z"),
		];

		const exceptions = [
			{
				start: new Date("2024-01-08T00:00:00Z"),
				end: new Date("2024-01-10T23:59:59Z"),
			},
		];

		const result = filterExceptionPeriods(timestamps, exceptions);

		expect(result).toHaveLength(3);
		expect(result).toEqual(timestamps);
	});

	it("should handle overlapping exception periods", () => {
		const timestamps = [
			new Date("2024-01-01T09:00:00Z"),
			new Date("2024-01-08T09:00:00Z"), // Within both exceptions
			new Date("2024-01-09T09:00:00Z"), // Within both exceptions
			new Date("2024-01-15T09:00:00Z"),
		];

		const exceptions = [
			{
				start: new Date("2024-01-07T00:00:00Z"),
				end: new Date("2024-01-10T23:59:59Z"),
			},
			{
				start: new Date("2024-01-08T00:00:00Z"),
				end: new Date("2024-01-12T23:59:59Z"),
			},
		];

		const result = filterExceptionPeriods(timestamps, exceptions);

		expect(result).toHaveLength(2);
		expect(result.map((d) => d.toISOString())).toEqual([
			"2024-01-01T09:00:00.000Z",
			"2024-01-15T09:00:00.000Z",
		]);
	});

	it("should handle empty timestamp array", () => {
		const timestamps: Date[] = [];
		const exceptions = [
			{
				start: new Date("2024-01-07T00:00:00Z"),
				end: new Date("2024-01-10T23:59:59Z"),
			},
		];

		const result = filterExceptionPeriods(timestamps, exceptions);

		expect(result).toHaveLength(0);
		expect(result).toEqual([]);
	});
});

describe("filterPastTimestamps", () => {
	it("should filter out past timestamps", () => {
		const now = new Date("2024-01-15T12:00:00Z");
		const timestamps = [
			new Date("2024-01-01T09:00:00Z"), // Past
			new Date("2024-01-08T09:00:00Z"), // Past
			new Date("2024-01-15T09:00:00Z"), // Past (same day, before reference)
			new Date("2024-01-22T09:00:00Z"), // Future
			new Date("2024-01-29T09:00:00Z"), // Future
		];

		const result = filterPastTimestamps(timestamps, now);

		expect(result).toHaveLength(2);
		expect(result.map((d) => d.toISOString())).toEqual([
			"2024-01-22T09:00:00.000Z",
			"2024-01-29T09:00:00.000Z",
		]);
	});

	it("should return all timestamps when all are in the future", () => {
		const now = new Date("2024-01-01T00:00:00Z");
		const timestamps = [
			new Date("2024-01-08T09:00:00Z"),
			new Date("2024-01-15T09:00:00Z"),
			new Date("2024-01-22T09:00:00Z"),
		];

		const result = filterPastTimestamps(timestamps, now);

		expect(result).toHaveLength(3);
	});

	it("should return empty array when all timestamps are in the past", () => {
		const now = new Date("2024-12-31T23:59:59Z");
		const timestamps = [
			new Date("2024-01-08T09:00:00Z"),
			new Date("2024-01-15T09:00:00Z"),
			new Date("2024-01-22T09:00:00Z"),
		];

		const result = filterPastTimestamps(timestamps, now);

		expect(result).toHaveLength(0);
	});

	it("should handle empty timestamp array", () => {
		const now = new Date("2024-01-15T12:00:00Z");
		const timestamps: Date[] = [];

		const result = filterPastTimestamps(timestamps, now);

		expect(result).toHaveLength(0);
		expect(result).toEqual([]);
	});

	it("should use current time as default reference", () => {
		// Use far future timestamps to ensure they're always future
		const timestamps = [
			new Date("2099-01-08T09:00:00Z"),
			new Date("2099-01-15T09:00:00Z"),
		];

		const result = filterPastTimestamps(timestamps);

		expect(result).toHaveLength(2);
	});
});
