import {
	computeOccurrenceEnd,
	computeOccurrenceStart,
} from "@ecehive/features";
import { prisma } from "@ecehive/prisma";
import z from "zod";
import type { TDashboardProtectedProcedureContext } from "../../trpc";

export const ZCurrentStaffingSchema = z.object({});

export type TCurrentStaffingSchema = z.infer<typeof ZCurrentStaffingSchema>;

export type TCurrentStaffingOptions = {
	ctx: TDashboardProtectedProcedureContext;
	input: TCurrentStaffingSchema;
};

// Types for assigned users within time slots
interface AssignedUser {
	id: number;
	name: string;
	status: "present" | "late" | "missing" | "not-started";
}

// A time slot groups all occurrences with the same start/end time
interface TimeSlot {
	startTime: Date;
	endTime: Date;
	totalSlots: number;
	emptySlots: number;
	assignedUsers: AssignedUser[];
}

// Grouped time slots by shift type
interface ShiftTypeGroup {
	shiftType: {
		id: number;
		name: string;
		location: string;
	};
	timeSlots: TimeSlot[];
}

export async function currentStaffingHandler(
	_options: TCurrentStaffingOptions,
) {
	const now = new Date();
	const thirtyMinutesFromNow = new Date(now.getTime() + 30 * 60 * 1000);

	// Get all users with active staffing sessions
	const activeStaffingSessions = await prisma.session.findMany({
		where: {
			endedAt: null,
			sessionType: "staffing",
		},
		select: {
			userId: true,
			startedAt: true,
		},
	});
	const activeUserIds = new Set(activeStaffingSessions.map((s) => s.userId));

	// Find all current occurrences (that are currently active)
	const currentOccurrences = await prisma.shiftOccurrence.findMany({
		where: {
			timestamp: {
				lte: now,
			},
		},
		include: {
			shiftSchedule: {
				select: {
					startTime: true,
					endTime: true,
					shiftType: {
						select: {
							id: true,
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
					didArriveLate: true,
					timeIn: true,
				},
			},
		},
		orderBy: { timestamp: "desc" },
		take: 100, // Get recent occurrences
	});

	// Find upcoming occurrences (next 30 minutes)
	const upcomingOccurrences = await prisma.shiftOccurrence.findMany({
		where: {
			timestamp: {
				gt: now,
				lte: thirtyMinutesFromNow,
			},
		},
		include: {
			shiftSchedule: {
				select: {
					startTime: true,
					endTime: true,
					shiftType: {
						select: {
							id: true,
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
		},
		orderBy: { timestamp: "asc" },
	});

	// Process current occurrences - group by shift type and time slot
	// Each occurrence represents ONE slot
	const currentByShiftType = new Map<
		number,
		{
			shiftType: { id: number; name: string; location: string };
			occurrences: Array<{
				startTime: Date;
				endTime: Date;
				users: AssignedUser[];
			}>;
		}
	>();

	for (const occ of currentOccurrences) {
		const occStart = computeOccurrenceStart(
			new Date(occ.timestamp),
			occ.shiftSchedule.startTime,
		);
		const occEnd = computeOccurrenceEnd(
			occStart,
			occ.shiftSchedule.startTime,
			occ.shiftSchedule.endTime,
		);

		// Skip occurrences that are not currently active
		if (occStart > now || occEnd <= now) continue;

		const assignedUsers: AssignedUser[] = occ.users.map((user) => {
			const attendance = occ.attendances.find((a) => a.userId === user.id);
			const isCurrentlyStaffing = activeUserIds.has(user.id);

			let status: AssignedUser["status"];
			if (isCurrentlyStaffing) {
				// User is currently staffing
				status = attendance?.didArriveLate ? "late" : "present";
			} else if (attendance?.timeIn) {
				// User was present but left (no longer has active session)
				status = "missing";
			} else {
				// User has not started attending yet
				status = "missing";
			}

			return {
				id: user.id,
				name: user.name,
				status,
			};
		});

		const shiftTypeId = occ.shiftSchedule.shiftType.id;
		const existing = currentByShiftType.get(shiftTypeId);
		if (existing) {
			existing.occurrences.push({
				startTime: occStart,
				endTime: occEnd,
				users: assignedUsers,
			});
		} else {
			currentByShiftType.set(shiftTypeId, {
				shiftType: {
					id: occ.shiftSchedule.shiftType.id,
					name: occ.shiftSchedule.shiftType.name,
					location: occ.shiftSchedule.shiftType.location,
				},
				occurrences: [
					{
						startTime: occStart,
						endTime: occEnd,
						users: assignedUsers,
					},
				],
			});
		}
	}

	// Group occurrences by time slot within each shift type
	// Each occurrence = 1 slot
	const currentShiftGroups: ShiftTypeGroup[] = [];
	for (const group of Array.from(currentByShiftType.values())) {
		const timeSlotMap = new Map<
			string,
			{
				startTime: Date;
				endTime: Date;
				totalSlots: number;
				filledSlots: number;
				users: AssignedUser[];
			}
		>();
		for (const occ of group.occurrences) {
			const key = `${occ.startTime.getTime()}-${occ.endTime.getTime()}`;
			const existing = timeSlotMap.get(key);
			const hasUsers = occ.users.length > 0;
			if (existing) {
				// Each occurrence is 1 slot
				existing.totalSlots += 1;
				if (hasUsers) {
					existing.filledSlots += 1;
				}
				// Merge users, avoiding duplicates
				for (const user of occ.users) {
					if (!existing.users.some((u) => u.id === user.id)) {
						existing.users.push(user);
					}
				}
			} else {
				timeSlotMap.set(key, {
					startTime: occ.startTime,
					endTime: occ.endTime,
					totalSlots: 1,
					filledSlots: hasUsers ? 1 : 0,
					users: [...occ.users],
				});
			}
		}
		const timeSlots: TimeSlot[] = Array.from(timeSlotMap.values())
			.map((slot) => ({
				startTime: slot.startTime,
				endTime: slot.endTime,
				totalSlots: slot.totalSlots,
				emptySlots: slot.totalSlots - slot.filledSlots,
				assignedUsers: slot.users,
			}))
			.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
		currentShiftGroups.push({
			shiftType: group.shiftType,
			timeSlots,
		});
	}
	currentShiftGroups.sort((a, b) =>
		a.shiftType.name.localeCompare(b.shiftType.name),
	);

	// Process upcoming occurrences - group by shift type and time slot
	// Each occurrence = 1 slot
	const upcomingByShiftType = new Map<
		number,
		{
			shiftType: { id: number; name: string; location: string };
			occurrences: Array<{
				startTime: Date;
				endTime: Date;
				users: AssignedUser[];
			}>;
		}
	>();

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

		const assignedUsers: AssignedUser[] = occ.users.map((user) => ({
			id: user.id,
			name: user.name,
			status: "not-started" as const,
		}));

		const shiftTypeId = occ.shiftSchedule.shiftType.id;
		const existing = upcomingByShiftType.get(shiftTypeId);
		if (existing) {
			existing.occurrences.push({
				startTime: occStart,
				endTime: occEnd,
				users: assignedUsers,
			});
		} else {
			upcomingByShiftType.set(shiftTypeId, {
				shiftType: {
					id: occ.shiftSchedule.shiftType.id,
					name: occ.shiftSchedule.shiftType.name,
					location: occ.shiftSchedule.shiftType.location,
				},
				occurrences: [
					{
						startTime: occStart,
						endTime: occEnd,
						users: assignedUsers,
					},
				],
			});
		}
	}

	// Group occurrences by time slot within each shift type
	// Each occurrence = 1 slot
	const upcomingShiftGroups: ShiftTypeGroup[] = [];
	for (const group of Array.from(upcomingByShiftType.values())) {
		const timeSlotMap = new Map<
			string,
			{
				startTime: Date;
				endTime: Date;
				totalSlots: number;
				filledSlots: number;
				users: AssignedUser[];
			}
		>();
		for (const occ of group.occurrences) {
			const key = `${occ.startTime.getTime()}-${occ.endTime.getTime()}`;
			const existing = timeSlotMap.get(key);
			const hasUsers = occ.users.length > 0;
			if (existing) {
				// Each occurrence is 1 slot
				existing.totalSlots += 1;
				if (hasUsers) {
					existing.filledSlots += 1;
				}
				// Merge users, avoiding duplicates
				for (const user of occ.users) {
					if (!existing.users.some((u) => u.id === user.id)) {
						existing.users.push(user);
					}
				}
			} else {
				timeSlotMap.set(key, {
					startTime: occ.startTime,
					endTime: occ.endTime,
					totalSlots: 1,
					filledSlots: hasUsers ? 1 : 0,
					users: [...occ.users],
				});
			}
		}
		const timeSlots: TimeSlot[] = Array.from(timeSlotMap.values())
			.map((slot) => ({
				startTime: slot.startTime,
				endTime: slot.endTime,
				totalSlots: slot.totalSlots,
				emptySlots: slot.totalSlots - slot.filledSlots,
				assignedUsers: slot.users,
			}))
			.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
		upcomingShiftGroups.push({
			shiftType: group.shiftType,
			timeSlots,
		});
	}
	upcomingShiftGroups.sort((a, b) =>
		a.shiftType.name.localeCompare(b.shiftType.name),
	);

	return {
		currentShiftGroups,
		upcomingShiftGroups,
	};
}
