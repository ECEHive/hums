import { queueEmail } from "@ecehive/email";
import { getLogger } from "@ecehive/logger";
import type { PrismaClient } from "@ecehive/prisma";
import { computeOccurrenceEnd, computeOccurrenceStart } from "../time-utils";

const logger = getLogger("attendance:excuse-decision-email");

/**
 * Queue an email notifying a user that staff granted or denied their excuse request.
 * Does nothing if the attendance has no excuse request.
 */
export async function queueExcuseDecisionEmail(
	prisma: PrismaClient,
	attendanceId: number,
	decision: "granted" | "denied",
): Promise<void> {
	try {
		const attendance = await prisma.shiftAttendance.findUnique({
			where: { id: attendanceId },
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

		if (!attendance?.excuseRequestedAt || !attendance.excuseRequestReason) {
			return;
		}

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

		await queueEmail({
			to: attendance.user.email,
			template: "excuse-decision",
			data: {
				userName: attendance.user.name,
				shiftTypeName: shiftSchedule.shiftType.name,
				shiftStart,
				shiftEnd,
				decision,
				requestReason: attendance.excuseRequestReason,
				staffNotes: attendance.excuseNotes,
			},
		});
	} catch (error) {
		logger.warn("Failed to queue excuse decision email", {
			attendanceId,
			error: error instanceof Error ? error.message : String(error),
		});
	}
}
