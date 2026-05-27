import {
	computeOccurrenceEnd,
	computeOccurrenceStart,
} from "@ecehive/features";
import { prisma } from "@ecehive/prisma";
import type { TPermissionProtectedProcedureContext } from "@ecehive/trpc/server";
import z from "zod";

export const ZCurrentStaffingSchema = z.object({});

export type TCurrentStaffingSchema = z.infer<typeof ZCurrentStaffingSchema>;

export type TCurrentStaffingOptions = {
	ctx: TPermissionProtectedProcedureContext;
	input: TCurrentStaffingSchema;
};

export interface StaffingUser {
	id: number;
	name: string;
	sessionStartedAt: Date;
	shiftInfo: {
		shiftTypeName: string;
		location: string;
		startTime: string;
		endTime: string;
		status: "present" | "late" | "no-shift";
	} | null;
}

export interface UpcomingShift {
	user: {
		id: number;
		name: string;
	};
	shiftType: {
		name: string;
		location: string;
	};
	startTime: Date;
	endTime: Date;
	status: "upcoming" | "missing";
}

export async function currentStaffingHandler(
	_options: TCurrentStaffingOptions,
) {
	const now = new Date();

	// Get all users with active staffing sessions
	const activeStaffingSessions = await prisma.session.findMany({
		where: {
			endedAt: null,
			sessionType: "staffing",
		},
		include: {
			user: {
				select: {
					id: true,
					name: true,
				},
			},
		},
	});

	// For each staffing user, find their current shift (if any)
	const staffingUsers: StaffingUser[] = await Promise.all(
		activeStaffingSessions.map(async (session) => {
			// Find active shift occurrence for this user
			const activeOccurrence = await prisma.shiftOccurrence.findFirst({
				where: {
					users: {
						some: { id: session.userId },
					},
					timestamp: {
						lte: now,
					},
				},
				include: {
					shiftSchedule: {
						include: {
							shiftType: {
								select: {
									name: true,
									location: true,
								},
							},
						},
					},
					attendances: {
						where: { userId: session.userId },
						select: {
							status: true,
							didArriveLate: true,
							timeIn: true,
						},
					},
				},
				orderBy: { timestamp: "desc" },
			});

			let shiftInfo: StaffingUser["shiftInfo"] = null;

			if (activeOccurrence) {
				const occStart = computeOccurrenceStart(
					new Date(activeOccurrence.timestamp),
					activeOccurrence.shiftSchedule.startTime,
				);
				const occEnd = computeOccurrenceEnd(
					occStart,
					activeOccurrence.shiftSchedule.startTime,
					activeOccurrence.shiftSchedule.endTime,
				);

				// Check if the occurrence is currently active
				if (occStart <= now && occEnd > now) {
					const attendance = activeOccurrence.attendances[0];
					shiftInfo = {
						shiftTypeName: activeOccurrence.shiftSchedule.shiftType.name,
						location: activeOccurrence.shiftSchedule.shiftType.location,
						startTime: activeOccurrence.shiftSchedule.startTime,
						endTime: activeOccurrence.shiftSchedule.endTime,
						status: attendance?.didArriveLate ? "late" : "present",
					};
				}
			}

			return {
				id: session.user.id,
				name: session.user.name,
				sessionStartedAt: session.startedAt,
				shiftInfo,
			};
		}),
	);

	// Find upcoming shifts (next 30 minutes) and check if staffers are missing
	const thirtyMinutesFromNow = new Date(now.getTime() + 30 * 60 * 1000);
	const upcomingOccurrences = await prisma.shiftOccurrence.findMany({
		where: {
			timestamp: {
				gte: now,
				lte: thirtyMinutesFromNow,
			},
		},
		include: {
			shiftSchedule: {
				include: {
					shiftType: {
						select: {
							name: true,
							location: true,
						},
					},
				},
			},
			users: {
				select: {
					id: true,
					name: true,
				},
			},
			attendances: {
				select: {
					userId: true,
					status: true,
				},
			},
		},
		orderBy: { timestamp: "asc" },
	});

	// Also find current shifts where assigned users are missing
	const currentMissingOccurrences = await prisma.shiftOccurrence.findMany({
		where: {
			timestamp: {
				lte: now,
			},
		},
		include: {
			shiftSchedule: {
				include: {
					shiftType: {
						select: {
							name: true,
							location: true,
						},
					},
				},
			},
			users: {
				select: {
					id: true,
					name: true,
				},
			},
			attendances: {
				select: {
					userId: true,
					status: true,
				},
			},
		},
		orderBy: { timestamp: "desc" },
		take: 20,
	});

	// Build upcoming/missing shifts list
	const activeUserIds = new Set(activeStaffingSessions.map((s) => s.userId));

	const upcomingShifts: UpcomingShift[] = [];

	// Add genuinely upcoming shifts
	for (const occ of upcomingOccurrences) {
		const occStart = computeOccurrenceStart(
			new Date(occ.timestamp),
			occ.shiftSchedule.startTime,
		);
		const occEnd = computeOccurrenceEnd(
			occStart,
			occ.shiftSchedule.startTime,
			occ.shiftSchedule.endTime,
		);

		for (const user of occ.users) {
			if (!activeUserIds.has(user.id)) {
				upcomingShifts.push({
					user: { id: user.id, name: user.name },
					shiftType: {
						name: occ.shiftSchedule.shiftType.name,
						location: occ.shiftSchedule.shiftType.location,
					},
					startTime: occStart,
					endTime: occEnd,
					status: "upcoming",
				});
			}
		}
	}

	// Add current shifts where assigned users are absent
	for (const occ of currentMissingOccurrences) {
		const occStart = computeOccurrenceStart(
			new Date(occ.timestamp),
			occ.shiftSchedule.startTime,
		);
		const occEnd = computeOccurrenceEnd(
			occStart,
			occ.shiftSchedule.startTime,
			occ.shiftSchedule.endTime,
		);

		// Only include currently active occurrences
		if (occStart > now || occEnd <= now) continue;

		const attendedUserIds = new Set(occ.attendances.map((a) => a.userId));

		for (const user of occ.users) {
			// Missing if not actively staffing and not recorded as present
			if (!activeUserIds.has(user.id) && !attendedUserIds.has(user.id)) {
				upcomingShifts.push({
					user: { id: user.id, name: user.name },
					shiftType: {
						name: occ.shiftSchedule.shiftType.name,
						location: occ.shiftSchedule.shiftType.location,
					},
					startTime: occStart,
					endTime: occEnd,
					status: "missing",
				});
			}
		}
	}

	return {
		staffingUsers,
		upcomingShifts,
	};
}
