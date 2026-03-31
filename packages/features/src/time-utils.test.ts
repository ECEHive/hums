import { describe, expect, it } from "vitest";
import {
	ATTENDANCE_GRACE_MINUTES,
	computeOccurrenceEnd,
	computeOccurrenceStart,
	isArrivalLate,
	isDepartureEarly,
} from "./time-utils";

// Helper to create a Date at a specific UTC time
function utc(iso: string): Date {
	return new Date(iso);
}

describe("computeOccurrenceStart", () => {
	it("should compute the start time from a timestamp and start time string", () => {
		// Use noon CDT so date is clearly June 10 in America/Chicago
		const timestamp = utc("2025-06-10T17:00:00Z");
		const result = computeOccurrenceStart(timestamp, "10:00:00");

		// The result should be 10:00 AM in the configured timezone on the same day
		expect(result).toBeInstanceOf(Date);
		// 10:00 CDT = 15:00 UTC, should be before noon CDT
		expect(result.getTime()).toBeLessThan(timestamp.getTime());
	});

	it("should handle midnight start time", () => {
		const timestamp = utc("2025-06-10T00:00:00Z");
		const result = computeOccurrenceStart(timestamp, "00:00:00");

		expect(result).toBeInstanceOf(Date);
	});

	it("should handle late evening start time", () => {
		const timestamp = utc("2025-06-10T00:00:00Z");
		const result = computeOccurrenceStart(timestamp, "23:30:00");

		expect(result).toBeInstanceOf(Date);
		expect(result.getTime()).toBeGreaterThan(timestamp.getTime());
	});
});

describe("computeOccurrenceEnd", () => {
	it("should compute the end time for a same-day shift", () => {
		const start = computeOccurrenceStart(
			utc("2025-06-10T00:00:00Z"),
			"10:00:00",
		);
		const result = computeOccurrenceEnd(start, "10:00:00", "12:00:00");

		expect(result).toBeInstanceOf(Date);
		// End should be after start
		expect(result.getTime()).toBeGreaterThan(start.getTime());

		// Duration should be approximately 2 hours
		const durationMs = result.getTime() - start.getTime();
		expect(durationMs).toBeCloseTo(2 * 60 * 60 * 1000, -3);
	});

	it("should handle overnight shift (end time before start time)", () => {
		const start = computeOccurrenceStart(
			utc("2025-06-10T00:00:00Z"),
			"22:00:00",
		);
		const result = computeOccurrenceEnd(start, "22:00:00", "02:00:00");

		// End should be after start (next day)
		expect(result.getTime()).toBeGreaterThan(start.getTime());

		// Duration should be approximately 4 hours
		const durationMs = result.getTime() - start.getTime();
		expect(durationMs).toBeCloseTo(4 * 60 * 60 * 1000, -3);
	});

	it("should compute correct duration for a 1-hour shift", () => {
		const start = computeOccurrenceStart(
			utc("2025-06-10T00:00:00Z"),
			"14:00:00",
		);
		const result = computeOccurrenceEnd(start, "14:00:00", "15:00:00");

		const durationMs = result.getTime() - start.getTime();
		expect(durationMs).toBeCloseTo(60 * 60 * 1000, -3);
	});

	it("should handle shift ending at midnight", () => {
		const start = computeOccurrenceStart(
			utc("2025-06-10T00:00:00Z"),
			"22:00:00",
		);
		const result = computeOccurrenceEnd(start, "22:00:00", "00:00:00");

		expect(result.getTime()).toBeGreaterThan(start.getTime());
		const durationMs = result.getTime() - start.getTime();
		expect(durationMs).toBeCloseTo(2 * 60 * 60 * 1000, -3);
	});
});

describe("isArrivalLate", () => {
	it("should return false when arrival is exactly on time", () => {
		const scheduledStart = utc("2025-06-10T10:00:00Z");
		const timeIn = utc("2025-06-10T10:00:00Z");
		expect(isArrivalLate(scheduledStart, timeIn)).toBe(false);
	});

	it("should return false when arrival is within grace period", () => {
		const scheduledStart = utc("2025-06-10T10:00:00Z");
		const withinGrace = new Date(
			scheduledStart.getTime() + (ATTENDANCE_GRACE_MINUTES - 1) * 60 * 1000,
		);
		expect(isArrivalLate(scheduledStart, withinGrace)).toBe(false);
	});

	it("should return false when arrival is exactly at grace period boundary", () => {
		const scheduledStart = utc("2025-06-10T10:00:00Z");
		const atBoundary = new Date(
			scheduledStart.getTime() + ATTENDANCE_GRACE_MINUTES * 60 * 1000,
		);
		expect(isArrivalLate(scheduledStart, atBoundary)).toBe(false);
	});

	it("should return true when arrival is beyond grace period", () => {
		const scheduledStart = utc("2025-06-10T10:00:00Z");
		const late = new Date(
			scheduledStart.getTime() + (ATTENDANCE_GRACE_MINUTES + 1) * 60 * 1000 + 1,
		);
		expect(isArrivalLate(scheduledStart, late)).toBe(true);
	});

	it("should return false for early arrival", () => {
		const scheduledStart = utc("2025-06-10T10:00:00Z");
		const early = utc("2025-06-10T09:50:00Z");
		expect(isArrivalLate(scheduledStart, early)).toBe(false);
	});

	it("should return false for null timeIn", () => {
		const scheduledStart = utc("2025-06-10T10:00:00Z");
		expect(isArrivalLate(scheduledStart, null)).toBe(false);
	});

	it("should return false for undefined timeIn", () => {
		const scheduledStart = utc("2025-06-10T10:00:00Z");
		expect(isArrivalLate(scheduledStart, undefined)).toBe(false);
	});

	it("should respect custom grace period", () => {
		const scheduledStart = utc("2025-06-10T10:00:00Z");
		const arrival = new Date(scheduledStart.getTime() + 11 * 60 * 1000); // 11 min late

		expect(isArrivalLate(scheduledStart, arrival, 10)).toBe(true);
		expect(isArrivalLate(scheduledStart, arrival, 15)).toBe(false);
	});
});

describe("isDepartureEarly", () => {
	it("should return false when departure is exactly at scheduled end", () => {
		const scheduledEnd = utc("2025-06-10T12:00:00Z");
		const timeOut = utc("2025-06-10T12:00:00Z");
		expect(isDepartureEarly(scheduledEnd, timeOut)).toBe(false);
	});

	it("should return false when departure is within grace period", () => {
		const scheduledEnd = utc("2025-06-10T12:00:00Z");
		const withinGrace = new Date(
			scheduledEnd.getTime() - (ATTENDANCE_GRACE_MINUTES - 1) * 60 * 1000,
		);
		expect(isDepartureEarly(scheduledEnd, withinGrace)).toBe(false);
	});

	it("should return false when departure is exactly at grace period boundary", () => {
		const scheduledEnd = utc("2025-06-10T12:00:00Z");
		const atBoundary = new Date(
			scheduledEnd.getTime() - ATTENDANCE_GRACE_MINUTES * 60 * 1000,
		);
		expect(isDepartureEarly(scheduledEnd, atBoundary)).toBe(false);
	});

	it("should return true when departure is before grace period", () => {
		const scheduledEnd = utc("2025-06-10T12:00:00Z");
		const early = new Date(
			scheduledEnd.getTime() - (ATTENDANCE_GRACE_MINUTES + 1) * 60 * 1000 - 1,
		);
		expect(isDepartureEarly(scheduledEnd, early)).toBe(true);
	});

	it("should return false for late departure (after scheduled end)", () => {
		const scheduledEnd = utc("2025-06-10T12:00:00Z");
		const late = utc("2025-06-10T12:10:00Z");
		expect(isDepartureEarly(scheduledEnd, late)).toBe(false);
	});

	it("should return false for null timeOut", () => {
		const scheduledEnd = utc("2025-06-10T12:00:00Z");
		expect(isDepartureEarly(scheduledEnd, null)).toBe(false);
	});

	it("should return false for undefined timeOut", () => {
		const scheduledEnd = utc("2025-06-10T12:00:00Z");
		expect(isDepartureEarly(scheduledEnd, undefined)).toBe(false);
	});

	it("should respect custom grace period", () => {
		const scheduledEnd = utc("2025-06-10T12:00:00Z");
		const departure = new Date(scheduledEnd.getTime() - 11 * 60 * 1000); // 11 min early

		expect(isDepartureEarly(scheduledEnd, departure, 10)).toBe(true);
		expect(isDepartureEarly(scheduledEnd, departure, 15)).toBe(false);
	});
});
