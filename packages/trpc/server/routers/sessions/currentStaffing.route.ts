import {
	computeOccurrenceEnd,
	computeOccurrenceStart,
} from "@ecehive/features";
import { prisma } from "@ecehive/prisma";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZCurrentStaffingSchema = z.object({});

export type TCurrentStaffingSchema = z.infer<typeof ZCurrentStaffingSchema>;

export type TCurrentStaffingOptions = {
	ctx: TPermissionProtectedProcedureContext;
	input: TCurrentStaffingSchema;
};

interface StaffingUser {
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

interface UpcomingShift {
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
					timeIn: true,
				},
			},
		},
		orderBy: { timestamp: "desc" },
		take: 50, // Recent occurrences
	});

	const upcomingShifts: UpcomingShift[] = [];
	const missingStaffers: UpcomingShift[] = [];
	const activeUserIds = new Set(staffingUsers.map((u) => u.id));

	// Process upcoming shifts
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
			upcomingShifts.push({
				user: {
					id: user.id,
					name: user.name,
				},
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

	// Process current shifts to find missing staffers
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

		// Only check shifts that are currently active
		if (occStart > now || occEnd <= now) continue;

		for (const user of occ.users) {
			// User is missing if they are NOT currently staffing (no active session)
			if (!activeUserIds.has(user.id)) {
				missingStaffers.push({
					user: {
						id: user.id,
						name: user.name,
					},
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

	// Sort upcoming shifts by start time
	upcomingShifts.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

	return {
		currentStaffers: staffingUsers,
		upcomingShifts: upcomingShifts.slice(0, 10),
		missingStaffers: missingStaffers.slice(0, 10),
	};
}
