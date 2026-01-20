import { prisma } from "@ecehive/prisma";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZShiftCoverageSchema = z.object({
	periodId: z.number().min(1),
	shiftTypeIds: z.array(z.number().min(1)).optional(),
	daysOfWeek: z.array(z.number().min(0).max(6)).optional(),
});

export type TShiftCoverageSchema = z.infer<typeof ZShiftCoverageSchema>;

export type TShiftCoverageOptions = {
	ctx?: TPermissionProtectedProcedureContext;
	input: TShiftCoverageSchema;
};

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatTime(time: string): string {
	const [hours, minutes] = time.split(":").map(Number);
	const period = hours >= 12 ? "PM" : "AM";
	const hours12 = hours % 12 || 12;
	if (minutes === 0) {
		return `${hours12}${period}`;
	}
	return `${hours12}:${minutes.toString().padStart(2, "0")}${period}`;
}

export async function shiftCoverageHandler(options: TShiftCoverageOptions) {
	const { periodId, shiftTypeIds, daysOfWeek } = options.input;

	// Build the where clause
	const where: {
		shiftType: { periodId: number; id?: { in: number[] } };
		dayOfWeek?: { in: number[] };
	} = {
		shiftType: { periodId },
	};

	if (shiftTypeIds && shiftTypeIds.length > 0) {
		where.shiftType.id = { in: shiftTypeIds };
	}

	if (daysOfWeek && daysOfWeek.length > 0) {
		where.dayOfWeek = { in: daysOfWeek };
	}

	// Fetch all schedules with user counts
	const schedules = await prisma.shiftSchedule.findMany({
		where,
		include: {
			shiftType: {
				select: {
					id: true,
					name: true,
					location: true,
				},
			},
			users: {
				select: { id: true },
			},
		},
		orderBy: [
			{ dayOfWeek: "asc" },
			{ startTime: "asc" },
			{ shiftType: { name: "asc" } },
		],
	});

	const reports = schedules.map((schedule) => {
		const dayLabel = DAYS_OF_WEEK[schedule.dayOfWeek];
		const timeSlot = `${dayLabel} ${formatTime(schedule.startTime)}-${formatTime(schedule.endTime)}`;
		const filledSlots = schedule.users.length;
		const totalSlots = schedule.slots;
		const coveragePercentage =
			totalSlots > 0 ? (filledSlots / totalSlots) * 100 : 0;

		return {
			shiftTypeId: schedule.shiftType.id,
			shiftTypeName: schedule.shiftType.name,
			shiftTypeLocation: schedule.shiftType.location,
			totalSlots,
			filledSlots,
			coveragePercentage,
			dayOfWeek: schedule.dayOfWeek,
			timeSlot,
			// Include raw times for proper sorting
			startTime: schedule.startTime,
		};
	});

	// Sort properly by day and then by time (using 24-hour format)
	reports.sort((a, b) => {
		if (a.dayOfWeek !== b.dayOfWeek) {
			return a.dayOfWeek - b.dayOfWeek;
		}
		// Compare start times using 24-hour format
		const [aHours, aMinutes] = a.startTime.split(":").map(Number);
		const [bHours, bMinutes] = b.startTime.split(":").map(Number);
		const aMinutesTotal = aHours * 60 + aMinutes;
		const bMinutesTotal = bHours * 60 + bMinutes;
		return aMinutesTotal - bMinutesTotal;
	});

	return {
		reports,
		total: reports.length,
	};
}
