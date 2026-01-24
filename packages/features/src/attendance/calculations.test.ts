import type { ShiftAttendanceStatus } from "@ecehive/prisma";
import { describe, expect, it } from "vitest";
import {
	type AttendanceForCalculation,
	calculateAttendanceStats,
	categorizeAttendanceIssue,
	isExcludedFromAttendanceRate,
	isProtectedAttendanceStatus,
	needsAdminReview,
} from "./calculations";

// Helper to create attendance records for testing
function createAttendance(
	overrides: Partial<AttendanceForCalculation> & {
		status: ShiftAttendanceStatus;
	},
): AttendanceForCalculation {
	const now = new Date();
	const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

	const defaults: AttendanceForCalculation = {
		status: "upcoming",
		isExcused: false,
		isMakeup: false,
		didArriveLate: false,
		didLeaveEarly: false,
		timeIn: null,
		timeOut: null,
		shiftOccurrence: {
			timestamp: twoHoursAgo,
			shiftSchedule: {
				startTime: "10:00:00",
				endTime: "11:00:00",
			},
		},
	};

	return {
		...defaults,
		...overrides,
	};
}

describe("isProtectedAttendanceStatus", () => {
	it("should return true for dropped status", () => {
		expect(isProtectedAttendanceStatus("dropped")).toBe(true);
	});

	it("should return true for dropped_makeup status", () => {
		expect(isProtectedAttendanceStatus("dropped_makeup")).toBe(true);
	});

	it("should return true for excused status", () => {
		expect(isProtectedAttendanceStatus("excused")).toBe(true);
	});

	it("should return false for present status", () => {
		expect(isProtectedAttendanceStatus("present")).toBe(false);
	});

	it("should return false for absent status", () => {
		expect(isProtectedAttendanceStatus("absent")).toBe(false);
	});

	it("should return false for upcoming status", () => {
		expect(isProtectedAttendanceStatus("upcoming")).toBe(false);
	});

	it("should return false for null/undefined", () => {
		expect(isProtectedAttendanceStatus(null)).toBe(false);
		expect(isProtectedAttendanceStatus(undefined)).toBe(false);
	});
});

describe("isExcludedFromAttendanceRate", () => {
	it("should return true for dropped status", () => {
		expect(isExcludedFromAttendanceRate("dropped")).toBe(true);
	});

	it("should return true for dropped_makeup status", () => {
		expect(isExcludedFromAttendanceRate("dropped_makeup")).toBe(true);
	});

	it("should return true for upcoming status", () => {
		expect(isExcludedFromAttendanceRate("upcoming")).toBe(true);
	});

	it("should return false for present status", () => {
		expect(isExcludedFromAttendanceRate("present")).toBe(false);
	});

	it("should return false for absent status", () => {
		expect(isExcludedFromAttendanceRate("absent")).toBe(false);
	});

	it("should return false for excused status", () => {
		// Excused shifts ARE included in attendance rate (as full credit)
		expect(isExcludedFromAttendanceRate("excused")).toBe(false);
	});
});

describe("calculateAttendanceStats", () => {
	it("should return zeroes for empty attendance array", () => {
		const stats = calculateAttendanceStats([]);

		expect(stats.totalShifts).toBe(0);
		expect(stats.presentCount).toBe(0);
		expect(stats.absentCount).toBe(0);
		expect(stats.excusedCount).toBe(0);
		expect(stats.attendanceRate).toBe(0);
	});

	it("should count present shifts correctly", () => {
		const attendances = [
			createAttendance({
				status: "present",
				timeIn: new Date("2024-01-01T10:00:00"),
				timeOut: new Date("2024-01-01T11:00:00"),
			}),
			createAttendance({
				status: "present",
				timeIn: new Date("2024-01-02T10:00:00"),
				timeOut: new Date("2024-01-02T11:00:00"),
			}),
		];

		const stats = calculateAttendanceStats(attendances);

		expect(stats.totalShifts).toBe(2);
		expect(stats.presentCount).toBe(2);
		expect(stats.attendanceRate).toBe(100);
	});

	it("should count absent shifts correctly", () => {
		const attendances = [
			createAttendance({
				status: "present",
				timeIn: new Date(),
				timeOut: new Date(),
			}),
			createAttendance({ status: "absent" }),
			createAttendance({ status: "absent" }),
		];

		const stats = calculateAttendanceStats(attendances);

		expect(stats.totalShifts).toBe(3);
		expect(stats.presentCount).toBe(1);
		expect(stats.absentCount).toBe(2);
		expect(stats.attendanceEligibleShiftCount).toBe(3);
		expect(stats.attendanceRate).toBeCloseTo(33.33, 1);
	});

	it("should exclude dropped shifts from attendance rate", () => {
		const attendances = [
			createAttendance({
				status: "present",
				timeIn: new Date(),
				timeOut: new Date(),
			}),
			createAttendance({ status: "dropped" }),
			createAttendance({ status: "dropped_makeup" }),
		];

		const stats = calculateAttendanceStats(attendances);

		expect(stats.totalShifts).toBe(3);
		expect(stats.droppedCount).toBe(1);
		expect(stats.droppedMakeupCount).toBe(1);
		expect(stats.attendanceEligibleShiftCount).toBe(1);
		// Only the present shift is eligible, so 100% rate
		expect(stats.attendanceRate).toBe(100);
	});

	it("should exclude upcoming shifts from attendance rate", () => {
		const futureTimestamp = new Date(Date.now() + 24 * 60 * 60 * 1000); // Tomorrow

		const attendances = [
			createAttendance({
				status: "present",
				timeIn: new Date(),
				timeOut: new Date(),
			}),
			createAttendance({
				status: "upcoming",
				shiftOccurrence: {
					timestamp: futureTimestamp,
					shiftSchedule: { startTime: "10:00:00", endTime: "11:00:00" },
				},
			}),
		];

		const stats = calculateAttendanceStats(attendances);

		expect(stats.totalShifts).toBe(2);
		expect(stats.upcomingShiftsCount).toBe(1);
		expect(stats.attendanceEligibleShiftCount).toBe(1);
		expect(stats.attendanceRate).toBe(100);
	});

	it("should count excused shifts as full credit", () => {
		const attendances = [
			createAttendance({
				status: "present",
				timeIn: new Date(),
				timeOut: new Date(),
			}),
			createAttendance({ status: "absent", isExcused: true }), // Absent but excused
			createAttendance({ status: "absent" }), // Absent not excused
		];

		const stats = calculateAttendanceStats(attendances);

		expect(stats.totalShifts).toBe(3);
		expect(stats.presentCount).toBe(1);
		expect(stats.excusedCount).toBe(1);
		expect(stats.absentCount).toBe(1);
		expect(stats.attendanceEligibleShiftCount).toBe(3);
		// 2 out of 3 count as attended (1 present + 1 excused)
		expect(stats.attendanceRate).toBeCloseTo(66.67, 1);
	});

	it("should handle excused status correctly", () => {
		const attendances = [
			createAttendance({ status: "excused" }),
			createAttendance({
				status: "present",
				timeIn: new Date(),
				timeOut: new Date(),
			}),
		];

		const stats = calculateAttendanceStats(attendances);

		expect(stats.excusedCount).toBe(1);
		expect(stats.presentCount).toBe(1);
		expect(stats.attendanceRate).toBe(100);
	});

	it("should count late arrivals correctly", () => {
		const attendances = [
			createAttendance({
				status: "present",
				didArriveLate: true,
				timeIn: new Date(),
				timeOut: new Date(),
			}),
			createAttendance({
				status: "present",
				didArriveLate: false,
				timeIn: new Date(),
				timeOut: new Date(),
			}),
		];

		const stats = calculateAttendanceStats(attendances);

		expect(stats.lateCount).toBe(1);
	});

	it("should count early departures correctly", () => {
		const attendances = [
			createAttendance({
				status: "present",
				didLeaveEarly: true,
				timeIn: new Date(),
				timeOut: new Date(),
			}),
			createAttendance({
				status: "present",
				didLeaveEarly: false,
				timeIn: new Date(),
				timeOut: new Date(),
			}),
		];

		const stats = calculateAttendanceStats(attendances);

		expect(stats.leftEarlyCount).toBe(1);
	});

	it("should calculate total hours worked correctly", () => {
		const attendances = [
			createAttendance({
				status: "present",
				timeIn: new Date("2024-01-01T10:00:00"),
				timeOut: new Date("2024-01-01T11:00:00"), // 1 hour
			}),
			createAttendance({
				status: "present",
				timeIn: new Date("2024-01-02T10:00:00"),
				timeOut: new Date("2024-01-02T12:30:00"), // 2.5 hours
			}),
		];

		const stats = calculateAttendanceStats(attendances);

		expect(stats.totalHoursWorked).toBe(3.5);
	});

	it("should give excused shifts full scheduled time as worked", () => {
		// Create an attendance with a 2-hour shift that was excused
		const attendances = [
			createAttendance({
				status: "absent",
				isExcused: true,
				shiftOccurrence: {
					timestamp: new Date("2024-01-01T09:00:00"),
					shiftSchedule: {
						startTime: "10:00:00",
						endTime: "12:00:00", // 2 hour shift
					},
				},
			}),
		];

		const stats = calculateAttendanceStats(attendances);

		expect(stats.excusedCount).toBe(1);
		expect(stats.totalScheduledHours).toBe(2);
		expect(stats.totalHoursWorked).toBe(2); // Full credit
		expect(stats.timeOnShiftPercentage).toBe(100);
	});

	it("should calculate time on shift percentage correctly", () => {
		const attendances = [
			createAttendance({
				status: "present",
				timeIn: new Date("2024-01-01T10:15:00"), // 15 min late
				timeOut: new Date("2024-01-01T10:45:00"), // 15 min early
				shiftOccurrence: {
					timestamp: new Date("2024-01-01T09:00:00"),
					shiftSchedule: {
						startTime: "10:00:00",
						endTime: "11:00:00", // 1 hour shift
					},
				},
			}),
		];

		const stats = calculateAttendanceStats(attendances);

		// Worked 30 min out of 60 min scheduled = 50%
		expect(stats.timeOnShiftPercentage).toBe(50);
	});

	it("should handle mixed statuses correctly", () => {
		const attendances = [
			createAttendance({
				status: "present",
				timeIn: new Date(),
				timeOut: new Date(),
			}),
			createAttendance({ status: "absent" }),
			createAttendance({ status: "dropped" }),
			createAttendance({ status: "dropped_makeup" }),
			createAttendance({ status: "absent", isExcused: true }),
			createAttendance({
				status: "upcoming",
				shiftOccurrence: {
					timestamp: new Date(Date.now() + 24 * 60 * 60 * 1000),
					shiftSchedule: { startTime: "10:00:00", endTime: "11:00:00" },
				},
			}),
		];

		const stats = calculateAttendanceStats(attendances);

		expect(stats.totalShifts).toBe(6);
		expect(stats.presentCount).toBe(1);
		expect(stats.absentCount).toBe(1);
		expect(stats.droppedCount).toBe(1);
		expect(stats.droppedMakeupCount).toBe(1);
		expect(stats.excusedCount).toBe(1);
		expect(stats.upcomingShiftsCount).toBe(1);
		expect(stats.attendanceEligibleShiftCount).toBe(3); // present, absent, excused
		// 2 out of 3 eligible (present + excused)
		expect(stats.attendanceRate).toBeCloseTo(66.67, 1);
	});
});

describe("needsAdminReview", () => {
	it("should return true for absent status", () => {
		expect(
			needsAdminReview({
				status: "absent",
				isExcused: false,
				didArriveLate: false,
				didLeaveEarly: false,
			}),
		).toBe(true);
	});

	it("should return true for dropped status", () => {
		expect(
			needsAdminReview({
				status: "dropped",
				isExcused: false,
				didArriveLate: false,
				didLeaveEarly: false,
			}),
		).toBe(true);
	});

	it("should return true for late arrival", () => {
		expect(
			needsAdminReview({
				status: "present",
				isExcused: false,
				didArriveLate: true,
				didLeaveEarly: false,
			}),
		).toBe(true);
	});

	it("should return true for early departure", () => {
		expect(
			needsAdminReview({
				status: "present",
				isExcused: false,
				didArriveLate: false,
				didLeaveEarly: true,
			}),
		).toBe(true);
	});

	it("should return false for excused attendance", () => {
		expect(
			needsAdminReview({
				status: "absent",
				isExcused: true,
				didArriveLate: false,
				didLeaveEarly: false,
			}),
		).toBe(false);
	});

	it("should return false for normal present attendance", () => {
		expect(
			needsAdminReview({
				status: "present",
				isExcused: false,
				didArriveLate: false,
				didLeaveEarly: false,
			}),
		).toBe(false);
	});

	it("should return false for excused status", () => {
		expect(
			needsAdminReview({
				status: "excused",
				isExcused: true,
				didArriveLate: false,
				didLeaveEarly: false,
			}),
		).toBe(false);
	});
});

describe("categorizeAttendanceIssue", () => {
	it("should return dropped for dropped status", () => {
		expect(
			categorizeAttendanceIssue({
				status: "dropped",
				didArriveLate: false,
				didLeaveEarly: false,
			}),
		).toBe("dropped");
	});

	it("should return absent for absent status", () => {
		expect(
			categorizeAttendanceIssue({
				status: "absent",
				didArriveLate: false,
				didLeaveEarly: false,
			}),
		).toBe("absent");
	});

	it("should return late for late arrival", () => {
		expect(
			categorizeAttendanceIssue({
				status: "present",
				didArriveLate: true,
				didLeaveEarly: false,
			}),
		).toBe("late");
	});

	it("should return left_early for early departure", () => {
		expect(
			categorizeAttendanceIssue({
				status: "present",
				didArriveLate: false,
				didLeaveEarly: true,
			}),
		).toBe("left_early");
	});

	it("should return partial for both late and early", () => {
		expect(
			categorizeAttendanceIssue({
				status: "present",
				didArriveLate: true,
				didLeaveEarly: true,
			}),
		).toBe("partial");
	});

	it("should return null for normal attendance", () => {
		expect(
			categorizeAttendanceIssue({
				status: "present",
				didArriveLate: false,
				didLeaveEarly: false,
			}),
		).toBe(null);
	});
});
