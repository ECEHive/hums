import { computeOccurrenceEnd } from "@ecehive/features";
import { prisma } from "@ecehive/prisma";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";
import { isWithinModifyWindow } from "./utils";

export const ZListMySchema = z.object({
	periodId: z.number().min(1),
	limit: z.number().min(1).max(100).optional(),
	offset: z.number().min(0).optional(),
});

export type TListMySchema = z.infer<typeof ZListMySchema>;

export type TListMyOptions = {
	ctx: TPermissionProtectedProcedureContext;
	input: TListMySchema;
};

/**
 * List shift occurrences for the current user in a specific period
 */
export async function listMyHandler(options: TListMyOptions) {
	const { periodId, limit = 50, offset = 0 } = options.input;
	const userId = options.ctx.user.id;

	const now = new Date();

	// Check if user has an active staffing session (only staffing sessions track attendance)
	const activeSession = await prisma.session.findFirst({
		where: {
			userId,
			endedAt: null,
			sessionType: "staffing",
		},
		select: { id: true },
	});

	const hasActiveSession = !!activeSession;

	// Get all upcoming/active shift occurrences for the user in this period
	// Filter to only show shifts that haven't ended yet
	const occurrences = await prisma.shiftOccurrence.findMany({
		where: {
			users: {
				some: {
					id: userId,
				},
			},
			shiftSchedule: {
				shiftType: {
					periodId,
				},
			},
			// Only include shifts where timestamp is today or in the future
			// This is a rough filter; we'll do exact filtering after computing end times
			timestamp: {
				gte: new Date(now.getTime() - 24 * 60 * 60 * 1000), // Allow shifts from yesterday (in case they wrap to today)
			},
		},
		include: {
			shiftSchedule: {
				include: {
					shiftType: {
						include: {
							period: true,
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
				where: {
					userId,
				},
				select: {
					id: true,
					status: true,
					timeIn: true,
					timeOut: true,
					didArriveLate: true,
					didLeaveEarly: true,
					isMakeup: true,
					droppedNotes: true,
				},
			},
		},
		orderBy: {
			timestamp: "asc",
		},
	});

	// Map to a cleaner format and filter out past shifts
	const mappedAndFiltered = occurrences
		.map((occ) => {
			const occStart = new Date(occ.timestamp);
			const occEnd = computeOccurrenceEnd(
				occStart,
				occ.shiftSchedule.startTime,
				occ.shiftSchedule.endTime,
			);

			const isActive = occStart <= now && occEnd > now;
			const period = occ.shiftSchedule.shiftType.period;
			const windowIsOpen = isWithinModifyWindow(period, now);
			const isBeforeStart = occStart > now;
			const canModify = windowIsOpen && isBeforeStart;

			// User is only tapped in if:
			// 1. The shift is currently active
			// 2. They have an active session
			// 3. They haven't already tapped out (attendance.timeOut is null)
			const attendance = occ.attendances[0];
			const isTappedIn =
				isActive &&
				hasActiveSession &&
				(!attendance || attendance.timeOut === null);

			return {
				id: occ.id,
				timestamp: occ.timestamp,
				slot: occ.slot,
				shiftScheduleId: occ.shiftScheduleId,
				shiftTypeId: occ.shiftSchedule.shiftType.id,
				shiftTypeName: occ.shiftSchedule.shiftType.name,
				shiftTypeLocation: occ.shiftSchedule.shiftType.location,
				shiftTypeColor: occ.shiftSchedule.shiftType.color,
				startTime: occ.shiftSchedule.startTime,
				endTime: occ.shiftSchedule.endTime,
				dayOfWeek: occ.shiftSchedule.dayOfWeek,
				users: occ.users,
				attendance: attendance || null,
				isActive,
				isTappedIn,
				occEnd,
				canDrop: canModify,
				canMakeup: canModify,
				modificationWindow: {
					start: period.scheduleModifyStart,
					end: period.scheduleModifyEnd,
					isOpen: windowIsOpen,
				},
			};
		})
		.filter((occ) => occ.occEnd > now); // Only include shifts that haven't ended yet

	// Total upcoming occurrences across the entire result set
	const total = mappedAndFiltered.length;

	// Apply pagination in-memory after filtering so `total` is correct.
	const paginated = mappedAndFiltered.slice(offset, offset + limit);

	return {
		occurrences: paginated,
		total,
	};
}
