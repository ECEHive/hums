import { env } from "@ecehive/env";
import { computeOccurrenceEnd } from "@ecehive/features";
import { getLogger } from "@ecehive/logger";
import { prisma } from "@ecehive/prisma";
import type { FastifyPluginAsync } from "fastify";
import { jwtVerify } from "jose";

const logger = getLogger("ical");

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
 * Generate a unique ID for an event
 */
function generateEventUid(occurrenceId: number, userId: number): string {
	return `shift-${occurrenceId}-user-${userId}@hums`;
}

/**
 * Build an iCal VEVENT block for a shift occurrence
 */
function buildVevent(
	occurrence: {
		id: number;
		timestamp: Date;
		shiftSchedule: {
			startTime: string;
			endTime: string;
			shiftType: {
				name: string;
				location: string;
				description: string | null;
			};
		};
	},
	userId: number,
	createdAt: Date,
): string {
	const startDate = new Date(occurrence.timestamp);
	const endDate = computeOccurrenceEnd(
		startDate,
		occurrence.shiftSchedule.startTime,
		occurrence.shiftSchedule.endTime,
	);

	const shiftType = occurrence.shiftSchedule.shiftType;
	const summary = escapeIcalText(`${shiftType.name} Shift`);
	const location = escapeIcalText(shiftType.location);
	const description = shiftType.description
		? escapeIcalText(shiftType.description)
		: escapeIcalText(`Shift at ${shiftType.location}`);

	const uid = generateEventUid(occurrence.id, userId);
	const dtstamp = formatIcalDateTime(createdAt);
	const dtstart = formatIcalDateTime(startDate);
	const dtend = formatIcalDateTime(endDate);

	return [
		"BEGIN:VEVENT",
		`UID:${uid}`,
		`DTSTAMP:${dtstamp}`,
		`DTSTART:${dtstart}`,
		`DTEND:${dtend}`,
		`SUMMARY:${summary}`,
		`LOCATION:${location}`,
		`DESCRIPTION:${description}`,
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
							name: true,
							location: true,
							description: true,
						},
					},
				},
			},
		},
		orderBy: {
			timestamp: "asc",
		},
	});

	// Get user info for the calendar name
	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: { name: true, username: true },
	});

	const calendarName = user?.name || user?.username || "User";

	// Build iCal content
	const vevents = occurrences.map((occ) => buildVevent(occ, userId, now));

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
