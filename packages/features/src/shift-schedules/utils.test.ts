import { describe, expect, it } from "vitest";
import {
	compareTimestamps,
	findNextDayOfWeek,
	generateOccurrenceTimestamps,
	parseTimeString,
} from "./utils";

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
		// Monday, January 1, 2024
		const startDate = new Date("2024-01-01T00:00:00Z");
		const result = findNextDayOfWeek(startDate, 1); // 1 = Monday

		expect(result).not.toBeNull();
		expect(result?.getUTCDay()).toBe(1); // Monday
		expect(result?.toISOString()).toBe("2024-01-01T00:00:00.000Z");
	});

	it("should find the next Friday when starting on a Monday", () => {
		// Monday, January 1, 2024
		const startDate = new Date("2024-01-01T00:00:00Z");
		const result = findNextDayOfWeek(startDate, 5); // 5 = Friday

		expect(result).not.toBeNull();
		expect(result?.getUTCDay()).toBe(5); // Friday
		// Should be Friday, January 5, 2024
		expect(result?.toISOString()).toBe("2024-01-05T00:00:00.000Z");
	});

	it("should find the next Sunday when starting on Saturday", () => {
		// Saturday, January 6, 2024
		const startDate = new Date("2024-01-06T00:00:00Z");
		const result = findNextDayOfWeek(startDate, 0); // 0 = Sunday

		expect(result).not.toBeNull();
		expect(result?.getUTCDay()).toBe(0); // Sunday
		// Should be Sunday, January 7, 2024
		expect(result?.toISOString()).toBe("2024-01-07T00:00:00.000Z");
	});

	it("should return null if target day is not found before end date", () => {
		// Monday, January 1, 2024
		const startDate = new Date("2024-01-01T00:00:00Z");
		// Tuesday, January 2, 2024
		const endDate = new Date("2024-01-02T00:00:00Z");
		// Looking for Friday (5)
		const result = findNextDayOfWeek(startDate, 5, endDate);

		expect(result).toBeNull();
	});

	it("should find the day within the end date boundary", () => {
		// Monday, January 1, 2024
		const startDate = new Date("2024-01-01T00:00:00Z");
		// Friday, January 5, 2024
		const endDate = new Date("2024-01-05T23:59:59Z");
		// Looking for Friday (5)
		const result = findNextDayOfWeek(startDate, 5, endDate);

		expect(result).not.toBeNull();
		expect(result?.getUTCDay()).toBe(5);
	});
});

describe("generateOccurrenceTimestamps", () => {
	it("should generate weekly occurrences for a month-long period", () => {
		// Period: January 1-31, 2024 (Monday to Wednesday)
		const periodStart = new Date("2024-01-01T00:00:00Z");
		const periodEnd = new Date("2024-01-31T23:59:59Z");

		// Every Monday at 9:00 AM
		const dayOfWeek = 1; // Monday
		const startTime = "09:00:00";

		const occurrences = generateOccurrenceTimestamps(
			periodStart,
			periodEnd,
			dayOfWeek,
			startTime,
		);

		// Should have 5 Mondays in January 2024: 1, 8, 15, 22, 29
		expect(occurrences).toHaveLength(5);

		// Check first occurrence
		expect(occurrences[0].toISOString()).toBe("2024-01-01T09:00:00.000Z");
		// Check last occurrence
		expect(occurrences[4].toISOString()).toBe("2024-01-29T09:00:00.000Z");

		// All should be Mondays
		occurrences.forEach((date) => {
			expect(date.getUTCDay()).toBe(1);
		});
	});

	it("should generate occurrences starting mid-week", () => {
		// Period: January 3-31, 2024 (Wednesday to Wednesday)
		const periodStart = new Date("2024-01-03T00:00:00Z");
		const periodEnd = new Date("2024-01-31T23:59:59Z");

		// Every Monday at 14:30:00
		const dayOfWeek = 1; // Monday
		const startTime = "14:30:00";

		const occurrences = generateOccurrenceTimestamps(
			periodStart,
			periodEnd,
			dayOfWeek,
			startTime,
		);

		// Should have 4 Mondays: 8, 15, 22, 29 (1st is before period start)
		expect(occurrences).toHaveLength(4);

		// Check first occurrence
		expect(occurrences[0].toISOString()).toBe("2024-01-08T14:30:00.000Z");
	});

	it("should generate no occurrences if day of week doesn't occur in period", () => {
		// Period: Monday Jan 1 to Tuesday Jan 2, 2024
		const periodStart = new Date("2024-01-01T00:00:00Z");
		const periodEnd = new Date("2024-01-02T23:59:59Z");

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
		// Period: January 1-31, 2024
		const periodStart = new Date("2024-01-01T00:00:00Z");
		const periodEnd = new Date("2024-01-31T23:59:59Z");

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

		// Check time is correctly set
		occurrences.forEach((date) => {
			expect(date.getUTCHours()).toBe(23);
			expect(date.getUTCMinutes()).toBe(45);
			expect(date.getUTCSeconds()).toBe(30);
		});
	});

	it("should handle Sunday as day of week (0)", () => {
		// Period: January 1-31, 2024
		const periodStart = new Date("2024-01-01T00:00:00Z");
		const periodEnd = new Date("2024-01-31T23:59:59Z");

		// Every Sunday at 08:00:00
		const dayOfWeek = 0; // Sunday
		const startTime = "08:00:00";

		const occurrences = generateOccurrenceTimestamps(
			periodStart,
			periodEnd,
			dayOfWeek,
			startTime,
		);

		// Sundays in January 2024: 7, 14, 21, 28
		expect(occurrences).toHaveLength(4);

		// All should be Sundays
		occurrences.forEach((date) => {
			expect(date.getUTCDay()).toBe(0);
		});
	});

	it("should exclude occurrences that fall exactly on period end", () => {
		// Period: Jan 1-7, 2024 (exactly one week)
		const periodStart = new Date("2024-01-01T09:00:00Z");
		const periodEnd = new Date("2024-01-08T09:00:00Z");

		// Every Monday at 9:00 AM
		const dayOfWeek = 1; // Monday
		const startTime = "09:00:00";

		const occurrences = generateOccurrenceTimestamps(
			periodStart,
			periodEnd,
			dayOfWeek,
			startTime,
		);

		// Should only include Jan 1, not Jan 8 (which equals periodEnd)
		expect(occurrences).toHaveLength(1);
		expect(occurrences[0].toISOString()).toBe("2024-01-01T09:00:00.000Z");
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
