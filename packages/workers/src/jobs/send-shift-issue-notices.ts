import { queueEmail } from "@ecehive/email";
import {
	ATTENDANCE_ISSUE_LABELS,
	categorizeAttendanceIssue,
	computeOccurrenceEnd,
	computeOccurrenceStart,
	getExcuseRequestDeadline,
} from "@ecehive/features";
import { getLogger } from "@ecehive/logger";
import { prisma } from "@ecehive/prisma";
import { CronJob } from "cron";

const logger = getLogger("workers:shift-issue-notices");

// Wait a few minutes after a shift ends so the attendance worker has finalized
const SHIFT_END_BUFFER_MS = 5 * 60 * 1000;
// Occurrence timestamps are the shift's date, and overnight shifts end the
// next day, so query a wider range and filter by exact shift end below
const OCCURRENCE_QUERY_RANGE_MS = 2 * 24 * 60 * 60 * 1000;

/**
 * Emails users about attendance issues (absent, late, left early) on shifts
 * that recently ended, with a link to request an excuse.
 *
 * Worker runs every 5 minutes and:
 * 1. Finds unexcused, unreviewed attendance records with issues where issueEmailSentAt is null
 * 2. Keeps shifts that ended (plus a buffer) and can still have an excuse requested
 * 3. Sets issueEmailSentAt then queues the email
 */
export async function sendShiftIssueNotices(): Promise<void> {
	try {
		const now = new Date();

		const attendances = await prisma.shiftAttendance.findMany({
			where: {
				issueEmailSentAt: null,
				excuseRequestedAt: null,
				reviewedAt: null,
				isExcused: false,
				status: { in: ["present", "absent"] },
				OR: [
					{ status: "absent" },
					{ didArriveLate: true },
					{ didLeaveEarly: true },
				],
				shiftOccurrence: {
					timestamp: {
						gte: new Date(now.getTime() - OCCURRENCE_QUERY_RANGE_MS),
						lte: now,
					},
				},
			},
			include: {
				user: { select: { name: true, email: true } },
				shiftOccurrence: {
					include: {
						shiftSchedule: {
							include: { shiftType: { select: { name: true } } },
						},
					},
				},
			},
		});

		let queued = 0;

		for (const attendance of attendances) {
			const { shiftSchedule } = attendance.shiftOccurrence;
			const shiftStart = computeOccurrenceStart(
				attendance.shiftOccurrence.timestamp,
				shiftSchedule.startTime,
			);
			const shiftEnd = computeOccurrenceEnd(
				shiftStart,
				shiftSchedule.startTime,
				shiftSchedule.endTime,
			);

			// Only email shifts that have finalized and can still have an excuse requested
			const requestDeadline = getExcuseRequestDeadline(shiftEnd);
			if (
				now.getTime() < shiftEnd.getTime() + SHIFT_END_BUFFER_MS ||
				now > requestDeadline
			) {
				continue;
			}

			const category = categorizeAttendanceIssue(attendance);
			if (!category) continue;

			try {
				// Claim the record first so concurrent runs never send duplicates
				const claimed = await prisma.shiftAttendance.updateMany({
					where: { id: attendance.id, issueEmailSentAt: null },
					data: { issueEmailSentAt: now },
				});
				if (claimed.count === 0) continue;

				await queueEmail({
					to: attendance.user.email,
					template: "shift-issue-notice",
					data: {
						userName: attendance.user.name,
						attendanceId: attendance.id,
						shiftTypeName: shiftSchedule.shiftType.name,
						shiftStart,
						shiftEnd,
						issues: [ATTENDANCE_ISSUE_LABELS[category]],
						timeIn: attendance.timeIn,
						timeOut: attendance.timeOut,
						requestDeadline,
					},
				});
				queued++;
			} catch (error) {
				logger.warn("Failed to queue shift issue notice email", {
					attendanceId: attendance.id,
					userId: attendance.userId,
					error: error instanceof Error ? error.message : String(error),
				});
				// Continue with other attendances even if one fails
			}
		}

		if (queued > 0) {
			logger.info("Queued shift issue notice emails", { count: queued });
		}
	} catch (err) {
		logger.error("Failed to process shift issue notices", {
			error: err instanceof Error ? err.message : String(err),
		});
		throw err;
	}
}

// Run every 5 minutes
export const sendShiftIssueNoticesJob = new CronJob(
	"*/5 * * * *",
	sendShiftIssueNotices,
);
