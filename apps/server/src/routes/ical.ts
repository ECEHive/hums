import { env } from "@ecehive/env";
import { computeOccurrenceEnd } from "@ecehive/features";
import { getLogger } from "@ecehive/logger";
import { prisma, type ShiftAttendanceStatus } from "@ecehive/prisma";
import type { FastifyPluginAsync } from "fastify";
import { jwtVerify } from "jose";

const logger = getLogger("ical");

/**
 * Attendance statuses that indicate a shift should be excluded from the calendar
 */
const EXCLUDED_ATTENDANCE_STATUSES: ShiftAttendanceStatus[] = [
	"dropped",
	"dropped_makeup",
];

/**
 * Escape special characters for iCal text fields
 */
function escapeIcalText(text: string): string {
	return text
		.replace(/\\/g, "\\\\")
		.replace(/;/g, "\\;")
		.replace(/,/g, "\\,")
		.replace(/\n/g, "\\n");
}

/**
 * Format a Date to iCal datetime format (YYYYMMDDTHHMMSS)
 */
function formatIcalDateTime(date: Date): string {
	const pad = (n: number) => n.toString().padStart(2, "0");
	return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

/**
 * Generate a unique ID for an event (or merged event group)
 */
function generateEventUid(occurrenceIds: number[], userId: number): string {
	// For merged events, create a stable UID based on all occurrence IDs
	const idsStr = occurrenceIds.sort((a, b) => a - b).join("-");
	return `shift-${idsStr}-user-${userId}@hums`;
}

type OccurrenceForCalendar = {
	id: number;
	timestamp: Date;
	updatedAt: Date;
	shiftSchedule: {
		startTime: string;
		endTime: string;
		shiftType: {
			id: number;
			name: string;
			location: string;
			description: string | null;
		};
	};
};

type MergedShift = {
	occurrenceIds: number[];
	startDate: Date;
	endDate: Date;
	latestUpdatedAt: Date;
	shiftType: {
		id: number;
		name: string;
		location: string;
		description: string | null;
	};
};

/**
 * Merge consecutive shifts of the same type into single events.
 * Two shifts are considered consecutive if:
 * 1. They have the same shift type (by ID)
 * 2. The end time of the first shift equals the start time of the next shift
 */
function mergeConsecutiveShifts(
	occurrences: OccurrenceForCalendar[],
): MergedShift[] {
	if (occurrences.length === 0) return [];

	// Sort by start time
	const sorted = [...occurrences].sort((a, b) => {
		const aStart = new Date(a.timestamp);
		const bStart = new Date(b.timestamp);
		return aStart.getTime() - bStart.getTime();
	});

	const mergedShifts: MergedShift[] = [];
	let currentMerge: MergedShift | null = null;

	for (const occ of sorted) {
		const occStartDate = new Date(occ.timestamp);
		const occEndDate = computeOccurrenceEnd(
			occStartDate,
			occ.shiftSchedule.startTime,
			occ.shiftSchedule.endTime,
		);
		const shiftType = occ.shiftSchedule.shiftType;

		if (currentMerge === null) {
			// Start a new merge group
			currentMerge = {
				occurrenceIds: [occ.id],
				startDate: occStartDate,
				endDate: occEndDate,
				latestUpdatedAt: occ.updatedAt,
				shiftType,
			};
		} else if (
			// Check if this occurrence is consecutive with the current merge
			currentMerge.shiftType.id === shiftType.id &&
			currentMerge.endDate.getTime() === occStartDate.getTime()
		) {
			// Merge: extend the end date
			currentMerge.occurrenceIds.push(occ.id);
			currentMerge.endDate = occEndDate;
			// Track the most recent update
			if (occ.updatedAt > currentMerge.latestUpdatedAt) {
				currentMerge.latestUpdatedAt = occ.updatedAt;
			}
		} else {
			// Not consecutive, save current merge and start a new one
			mergedShifts.push(currentMerge);
			currentMerge = {
				occurrenceIds: [occ.id],
				startDate: occStartDate,
				endDate: occEndDate,
				latestUpdatedAt: occ.updatedAt,
				shiftType,
			};
		}
	}

	// Don't forget the last merge group
	if (currentMerge !== null) {
		mergedShifts.push(currentMerge);
	}

	return mergedShifts;
}

/**
 * Build an iCal VEVENT block for a merged shift
 */
function buildVevent(
	mergedShift: MergedShift,
	userId: number,
	createdAt: Date,
): string {
	const { shiftType, startDate, endDate, latestUpdatedAt, occurrenceIds } =
		mergedShift;

	const summary = escapeIcalText(`${shiftType.name} Shift`);
	const location = escapeIcalText(shiftType.location);
	const description = shiftType.description
		? escapeIcalText(shiftType.description)
		: escapeIcalText(`Shift at ${shiftType.location}`);

	const uid = generateEventUid(occurrenceIds, userId);
	const dtstamp = formatIcalDateTime(createdAt);
	const dtstart = formatIcalDateTime(startDate);
	const dtend = formatIcalDateTime(endDate);
	const lastModified = formatIcalDateTime(latestUpdatedAt);

	return [
		"BEGIN:VEVENT",
		`UID:${uid}`,
		`DTSTAMP:${dtstamp}`,
		`DTSTART:${dtstart}`,
		`DTEND:${dtend}`,
		`SUMMARY:${summary}`,
		`LOCATION:${location}`,
		`DESCRIPTION:${description}`,
		`LAST-MODIFIED:${lastModified}`,
		"SEQUENCE:0",
		"STATUS:CONFIRMED",
		"END:VEVENT",
	].join("\r\n");
}

/**
 * Generate a complete iCal file content for a user's shifts
 */
async function generateIcalForUser(userId: number): Promise<string> {
	const now = new Date();

	// Get all shift occurrences for this user (past, current, and future)
	// Include attendance data to filter out dropped/makeup shifts
	const occurrences = await prisma.shiftOccurrence.findMany({
		where: {
			users: {
				some: {
					id: userId,
				},
			},
		},
		include: {
			shiftSchedule: {
				include: {
					shiftType: {
						select: {
							id: true,
							name: true,
							location: true,
							description: true,
						},
					},
				},
			},
			attendances: {
				where: {
					userId,
				},
				select: {
					status: true,
					isMakeup: true,
				},
			},
		},
		orderBy: {
			timestamp: "asc",
		},
	});

	// Filter out:
	// 1. Occurrences where the user has a "dropped" or "dropped_makeup" attendance status
	// 2. Occurrences that are being made up (the original shift that was dropped)
	// Note: We INCLUDE occurrences where isMakeup=true, as those are the replacement shifts
	// that the user IS attending
	const validOccurrences = occurrences.filter((occ) => {
		const attendance = occ.attendances[0];
		if (!attendance) {
			// No attendance record - include the shift
			return true;
		}

		// Exclude if the attendance status is dropped or dropped_makeup
		if (EXCLUDED_ATTENDANCE_STATUSES.includes(attendance.status)) {
			return false;
		}

		return true;
	});

	// Transform to the format expected by mergeConsecutiveShifts
	const occurrencesForCalendar: OccurrenceForCalendar[] = validOccurrences.map(
		(occ) => ({
			id: occ.id,
			timestamp: occ.timestamp,
			updatedAt: occ.updatedAt,
			shiftSchedule: {
				startTime: occ.shiftSchedule.startTime,
				endTime: occ.shiftSchedule.endTime,
				shiftType: occ.shiftSchedule.shiftType,
			},
		}),
	);

	// Merge consecutive shifts of the same type
	const mergedShifts = mergeConsecutiveShifts(occurrencesForCalendar);

	// Get user info for the calendar name
	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: { name: true, username: true },
	});

	const calendarName = user?.name || user?.username || "User";

	// Build iCal content from merged shifts
	const vevents = mergedShifts.map((merged) =>
		buildVevent(merged, userId, now),
	);

	const icalContent = [
		"BEGIN:VCALENDAR",
		"VERSION:2.0",
		"PRODID:-//HUMS//Shift Calendar//EN",
		"CALSCALE:GREGORIAN",
		"METHOD:PUBLISH",
		`X-WR-CALNAME:${escapeIcalText(`${calendarName}'s HUMS Shifts`)}`,
		`X-WR-CALDESC:${escapeIcalText("Shift schedule from HUMS")}`,
		...vevents,
		"END:VCALENDAR",
	].join("\r\n");

	return icalContent;
}

/**
 * Validate an iCal token and extract the user ID
 */
async function validateIcalToken(token: string): Promise<number | null> {
	try {
		const { payload } = await jwtVerify(token, env.ICAL_SECRET);

		if (payload.type !== "ical" || typeof payload.userId !== "number") {
			return null;
		}

		return payload.userId;
	} catch (error) {
		logger.warn("iCal token validation failed", {
			error: error instanceof Error ? error.message : String(error),
		});
		return null;
	}
}

export const icalRoute: FastifyPluginAsync = async (fastify) => {
	// Route: GET /api/ical/:token.ical
	fastify.get<{
		Params: { token: string };
	}>("/:token.ical", async (request, reply) => {
		const { token } = request.params;

		// Validate the token
		const userId = await validateIcalToken(token);

		if (!userId) {
			return reply.status(401).send({
				error: "Invalid or expired calendar token",
			});
		}

		// Verify user exists
		const userExists = await prisma.user.findUnique({
			where: { id: userId },
			select: { id: true },
		});

		if (!userExists) {
			return reply.status(404).send({
				error: "User not found",
			});
		}

		try {
			// Generate iCal content
			const icalContent = await generateIcalForUser(userId);

			// Set appropriate headers for iCal file
			reply.header("Content-Type", "text/calendar; charset=utf-8");
			reply.header("Content-Disposition", 'attachment; filename="shifts.ics"');

			return reply.send(icalContent);
		} catch (error) {
			logger.error("Failed to generate iCal", {
				userId,
				error: error instanceof Error ? error.message : String(error),
			});
			return reply.status(500).send({
				error: "Failed to generate calendar",
			});
		}
	});
};
