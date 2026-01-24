import type { ShiftAttendanceStatus } from "@ecehive/prisma";
import { computeOccurrenceEnd, computeOccurrenceStart } from "../time-utils";

/**
 * Statuses that exclude a shift from attendance rate calculations.
 * - dropped: User dropped the shift without a makeup
 * - dropped_makeup: User dropped and selected a makeup (evaluated separately)
 * - upcoming: Shift hasn't occurred yet
 * - excused: User was excused (counts as full credit, not toward eligible count)
 */
export const ATTENDANCE_EXCLUDED_STATUSES: ShiftAttendanceStatus[] = [
	"dropped",
	"dropped_makeup",
	"upcoming",
];

/**
 * Statuses that should never be modified by the background attendance worker.
 * These represent user-initiated actions that should be preserved.
 */
export const PROTECTED_ATTENDANCE_STATUSES: ShiftAttendanceStatus[] = [
	"dropped",
	"dropped_makeup",
	"excused",
];

/**
 * Statuses that indicate a user did not fulfill their shift obligation.
 * Used for identifying missed shifts for the admin review page.
 */
export const NEGATIVE_ATTENDANCE_STATUSES: ShiftAttendanceStatus[] = [
	"absent",
	"dropped",
];

/**
 * Check if an attendance status is protected from automatic updates.
 */
export function isProtectedAttendanceStatus(
	status?: ShiftAttendanceStatus | null,
): boolean {
	return status ? PROTECTED_ATTENDANCE_STATUSES.includes(status) : false;
}

/**
 * Check if an attendance should be excluded from attendance rate calculations.
 */
export function isExcludedFromAttendanceRate(
	status: ShiftAttendanceStatus,
): boolean {
	return ATTENDANCE_EXCLUDED_STATUSES.includes(status);
}

/**
 * Represents an attendance record with the minimal fields needed for calculations.
 */
export interface AttendanceForCalculation {
	status: ShiftAttendanceStatus;
	isExcused: boolean;
	isMakeup: boolean;
	didArriveLate: boolean;
	didLeaveEarly: boolean;
	timeIn: Date | null;
	timeOut: Date | null;
	shiftOccurrence: {
		timestamp: Date;
		shiftSchedule: {
			startTime: string;
			endTime: string;
		};
	};
}

/**
 * The result of calculating attendance statistics for a user.
 */
export interface AttendanceStats {
	/** Total number of attendance records */
	totalShifts: number;
	/** Number of shifts with 'present' status */
	presentCount: number;
	/** Number of shifts with 'absent' status */
	absentCount: number;
	/** Number of shifts where user arrived late */
	lateCount: number;
	/** Number of shifts where user left early */
	leftEarlyCount: number;
	/** Number of shifts with 'dropped' status (no makeup) */
	droppedCount: number;
	/** Number of shifts with 'dropped_makeup' status */
	droppedMakeupCount: number;
	/** Number of shifts that are excused */
	excusedCount: number;
	/** Number of shifts that are still upcoming */
	upcomingShiftsCount: number;
	/** Number of shifts eligible for attendance rate calculation (past, non-dropped) */
	attendanceEligibleShiftCount: number;
	/**
	 * Attendance rate as percentage (0-100).
	 * Formula: (presentCount + excusedCount) / attendanceEligibleShiftCount * 100
	 * Excused shifts count as full credit (100% attendance for that shift).
	 */
	attendanceRate: number;
	/** Total hours actually worked (from timeIn to timeOut) */
	totalHoursWorked: number;
	/** Total scheduled hours for eligible shifts */
	totalScheduledHours: number;
	/**
	 * Percentage of scheduled time actually worked (0-100).
	 * Formula: totalHoursWorked / totalScheduledHours * 100
	 * Note: Excused shifts contribute full scheduled time to both numerator and denominator.
	 */
	timeOnShiftPercentage: number;
}

/**
 * Calculate comprehensive attendance statistics from a list of attendance records.
 *
 * Calculation rules:
 * - Dropped shifts (dropped, dropped_makeup) are excluded from attendance rate
 * - Upcoming shifts are excluded from attendance rate
 * - Excused shifts count as full credit (100% attendance, full time worked)
 * - Present + excused shifts form the numerator for attendance rate
 * - Only eligible (past, non-dropped) shifts are in the denominator
 *
 * @param attendances - Array of attendance records to calculate stats for
 * @param referenceTime - Time to compare against for determining upcoming shifts (defaults to now)
 * @returns Comprehensive attendance statistics
 */
export function calculateAttendanceStats(
	attendances: AttendanceForCalculation[],
	referenceTime: Date = new Date(),
): AttendanceStats {
	let presentCount = 0;
	let absentCount = 0;
	let lateCount = 0;
	let leftEarlyCount = 0;
	let totalHoursWorked = 0;
	let totalScheduledHours = 0;
	let droppedCount = 0;
	let droppedMakeupCount = 0;
	let excusedCount = 0;
	let attendanceEligibleShiftCount = 0;
	let upcomingShiftsCount = 0;

	for (const attendance of attendances) {
		const { status, isExcused } = attendance;

		// Count dropped shifts separately
		if (status === "dropped") {
			droppedCount++;
			continue;
		}

		if (status === "dropped_makeup") {
			droppedMakeupCount++;
			continue;
		}

		// Handle upcoming status explicitly
		if (status === "upcoming") {
			upcomingShiftsCount++;
			continue;
		}

		const scheduledStart = computeOccurrenceStart(
			new Date(attendance.shiftOccurrence.timestamp),
			attendance.shiftOccurrence.shiftSchedule.startTime,
		);
		const scheduledEnd = computeOccurrenceEnd(
			scheduledStart,
			attendance.shiftOccurrence.shiftSchedule.startTime,
			attendance.shiftOccurrence.shiftSchedule.endTime,
		);

		// Double-check by date in case status hasn't been updated yet
		if (scheduledStart > referenceTime) {
			upcomingShiftsCount++;
			continue;
		}

		// This is an eligible shift for attendance calculation
		attendanceEligibleShiftCount++;

		const scheduledDurationMs =
			scheduledEnd.getTime() - scheduledStart.getTime();
		const scheduledHours = scheduledDurationMs / (1000 * 60 * 60);
		totalScheduledHours += scheduledHours;

		// Handle excused shifts - count as full credit
		if (isExcused || status === "excused") {
			excusedCount++;
			// Excused shifts contribute full scheduled time as "worked"
			totalHoursWorked += scheduledHours;
			continue;
		}

		// Handle present/absent status
		if (status === "present") {
			presentCount++;
		} else if (status === "absent") {
			absentCount++;
		}

		// Count late/early issues
		if (attendance.didArriveLate) {
			lateCount++;
		}
		if (attendance.didLeaveEarly) {
			leftEarlyCount++;
		}

		// Calculate actual hours worked
		if (attendance.timeIn && attendance.timeOut) {
			const durationMs =
				attendance.timeOut.getTime() - attendance.timeIn.getTime();
			totalHoursWorked += durationMs / (1000 * 60 * 60);
		}
	}

	const totalShifts = attendances.length;

	// Attendance rate: (present + excused) / eligible * 100
	// Excused shifts count as full attendance credit
	const attendanceRate =
		attendanceEligibleShiftCount > 0
			? ((presentCount + excusedCount) / attendanceEligibleShiftCount) * 100
			: 0;

	// Time percentage: actual worked / scheduled * 100
	const timeOnShiftPercentage =
		totalScheduledHours > 0
			? (totalHoursWorked / totalScheduledHours) * 100
			: 0;

	return {
		totalShifts,
		presentCount,
		absentCount,
		lateCount,
		leftEarlyCount,
		droppedCount,
		droppedMakeupCount,
		excusedCount,
		attendanceRate: Math.round(attendanceRate * 100) / 100,
		totalHoursWorked: Math.round(totalHoursWorked * 100) / 100,
		totalScheduledHours: Math.round(totalScheduledHours * 100) / 100,
		timeOnShiftPercentage: Math.round(timeOnShiftPercentage * 100) / 100,
		upcomingShiftsCount,
		attendanceEligibleShiftCount,
	};
}

/**
 * Determines if a shift should be flagged for admin review.
 *
 * A shift needs review if:
 * - Status is 'absent' (user didn't show up)
 * - Status is 'dropped' (user dropped without makeup)
 * - User arrived late (didArriveLate is true)
 * - User left early (didLeaveEarly is true)
 *
 * Shifts that are already excused or are makeup shifts that were attended
 * do not need review.
 *
 * @param attendance - The attendance record to check
 * @returns True if the shift needs admin review
 */
export function needsAdminReview(attendance: {
	status: ShiftAttendanceStatus;
	isExcused: boolean;
	didArriveLate: boolean;
	didLeaveEarly: boolean;
}): boolean {
	// Already excused - no review needed
	if (attendance.isExcused || attendance.status === "excused") {
		return false;
	}

	// Check for issues that need review
	if (attendance.status === "absent") return true;
	if (attendance.status === "dropped") return true;
	if (attendance.didArriveLate) return true;
	if (attendance.didLeaveEarly) return true;

	return false;
}

/**
 * Categories of attendance issues for the admin review page.
 */
export type AttendanceIssueCategory =
	| "dropped"
	| "absent"
	| "late"
	| "left_early"
	| "partial"; // late AND left early

/**
 * Categorize an attendance issue for display in the admin UI.
 */
export function categorizeAttendanceIssue(attendance: {
	status: ShiftAttendanceStatus;
	didArriveLate: boolean;
	didLeaveEarly: boolean;
}): AttendanceIssueCategory | null {
	if (attendance.status === "dropped") return "dropped";
	if (attendance.status === "absent") return "absent";

	if (attendance.didArriveLate && attendance.didLeaveEarly) return "partial";
	if (attendance.didArriveLate) return "late";
	if (attendance.didLeaveEarly) return "left_early";

	return null;
}
