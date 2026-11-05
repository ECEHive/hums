import type { ShiftAttendanceStatus } from "@ecehive/prisma";
import {
	type AttendanceIssueCategory,
	categorizeAttendanceIssue,
} from "./calculations";

/** How long after a shift ends a user can request an excuse */
export const EXCUSE_REQUEST_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Labels used for emails */
export const ATTENDANCE_ISSUE_LABELS: Record<AttendanceIssueCategory, string> =
	{
		dropped: "Dropped",
		absent: "Absent",
		late: "Arrived late",
		left_early: "Left early",
		partial: "Arrived late and left early",
	};

type ExcuseRequestAttendance = {
	status: ShiftAttendanceStatus;
	isExcused: boolean;
	didArriveLate: boolean;
	didLeaveEarly: boolean;
	reviewedAt: Date | null;
	excuseRequestedAt: Date | null;
};

export type ExcuseRequestEligibility =
	| { eligible: true; deadline: Date }
	| { eligible: false; reason: string };

/**
 * Get the last moment a user can request an excuse for a shift.
 */
export function getExcuseRequestDeadline(shiftEnd: Date): Date {
	return new Date(shiftEnd.getTime() + EXCUSE_REQUEST_WINDOW_MS);
}

/**
 * Determine whether a user can request an excuse for an attendance record.
 * Excuses can be requested for absent, late, and left early issues once the shift has ended.
 */
export function getExcuseRequestEligibility(
	attendance: ExcuseRequestAttendance,
	shiftEnd: Date,
	now: Date = new Date(),
): ExcuseRequestEligibility {
	if (attendance.isExcused || attendance.status === "excused") {
		return { eligible: false, reason: "This shift is already excused" };
	}

	if (attendance.excuseRequestedAt) {
		return {
			eligible: false,
			reason: "An excuse has already been requested for this shift",
		};
	}

	if (attendance.reviewedAt) {
		return {
			eligible: false,
			reason: "This shift has already been reviewed by staff",
		};
	}

	const issue = categorizeAttendanceIssue(attendance);
	if (!issue) {
		return {
			eligible: false,
			reason: "This shift has no attendance issues to excuse",
		};
	}

	if (issue === "dropped") {
		return {
			eligible: false,
			reason:
				"Dropped shifts are reviewed using the reason given when dropping",
		};
	}

	if (now < shiftEnd) {
		return {
			eligible: false,
			reason: "You can request an excuse once the shift has ended",
		};
	}

	const deadline = getExcuseRequestDeadline(shiftEnd);
	if (now > deadline) {
		return {
			eligible: false,
			reason: "The window to request an excuse for this shift has closed",
		};
	}

	return { eligible: true, deadline };
}
