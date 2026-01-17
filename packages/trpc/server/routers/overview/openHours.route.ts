import { prisma } from "@ecehive/prisma";
import z from "zod";
import type { Context } from "../../context";

export const ZOpenHoursSchema = z.object({});

export type TOpenHoursSchema = z.infer<typeof ZOpenHoursSchema>;

export type TOpenHoursOptions = {
	ctx: Context;
	input: TOpenHoursSchema;
};

interface TimeRange {
	start: string; // HH:mm format
	end: string; // HH:mm format
}

interface DaySchedule {
	dayOfWeek: number; // 0 = Sunday, 6 = Saturday
	dayName: string;
	ranges: TimeRange[];
	formattedHours: string; // e.g., "10:00am - 6:00pm" or "Closed"
}

interface PeriodException {
	name: string;
	start: Date;
	end: Date;
}

interface PeriodHours {
	periodId: number;
	periodName: string;
	periodStart: Date;
	periodEnd: Date;
	schedule: DaySchedule[];
	exceptions: PeriodException[];
}

interface OpenHoursResponse {
	periods: PeriodHours[];
	cachedAt: Date;
}

const DAY_NAMES = [
	"Sunday",
	"Monday",
	"Tuesday",
	"Wednesday",
	"Thursday",
	"Friday",
	"Saturday",
];

// Cache for open hours calculation
let cachedOpenHours: OpenHoursResponse | null = null;
let cacheExpiry: Date | null = null;
const CACHE_DURATION_MS = 30 * 1000; // 30 seconds

/**
 * Parse time string (HH:mm) to minutes since midnight
 */
function timeToMinutes(time: string): number {
	// Validate basic format "HH:mm"
	if (!/^\d{2}:\d{2}$/.test(time)) {
		return NaN;
	}

	const [hoursStr, minutesStr] = time.split(":");
	const hours = Number(hoursStr);
	const minutes = Number(minutesStr);

	// Ensure numeric values and valid ranges
	if (
		!Number.isInteger(hours) ||
		!Number.isInteger(minutes) ||
		hours < 0 ||
		hours > 23 ||
		minutes < 0 ||
		minutes > 59
	) {
		return NaN;
	}

	return hours * 60 + minutes;
}

/**
 * Convert minutes since midnight to time string (HH:mm)
 */
function minutesToTime(minutes: number): string {
	const hours = Math.floor(minutes / 60);
	const mins = minutes % 60;
	return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
}

/**
 * Format time in 12-hour format (e.g., "10:00am")
 */
function formatTime12Hour(time: string): string {
	// Validate format HH:mm before parsing
	if (!/^\d{2}:\d{2}$/.test(time)) {
		return "Invalid time";
	}

	const [hoursStr, minutesStr] = time.split(":");
	const hours = Number(hoursStr);
	const minutes = Number(minutesStr);

	// Validate ranges
	if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
		return "Invalid time";
	}

	const period = hours >= 12 ? "pm" : "am";
	const hour12 = hours % 12 || 12;
	return `${hour12}:${minutes.toString().padStart(2, "0")}${period}`;
}

/**
 * Merge overlapping or adjacent time ranges
 */
function mergeTimeRanges(ranges: TimeRange[]): TimeRange[] {
	if (ranges.length === 0) return [];

	// Sort by start time
	const sorted = [...ranges].sort(
		(a, b) => timeToMinutes(a.start) - timeToMinutes(b.start),
	);

	const merged: TimeRange[] = [];
	let current = { ...sorted[0] };

	for (let i = 1; i < sorted.length; i++) {
		const next = sorted[i];
		const currentEnd = timeToMinutes(current.end);
		const nextStart = timeToMinutes(next.start);

		// If ranges overlap or are adjacent, merge them
		if (nextStart <= currentEnd) {
			current.end = minutesToTime(
				Math.max(currentEnd, timeToMinutes(next.end)),
			);
		} else {
			merged.push(current);
			current = { ...next };
		}
	}
	merged.push(current);

	return merged;
}

/**
 * Format merged time ranges into a human-readable string
 */
function formatDayHours(ranges: TimeRange[]): string {
	if (ranges.length === 0) return "Closed";

	return ranges
		.map((r) => `${formatTime12Hour(r.start)} - ${formatTime12Hour(r.end)}`)
		.join(", ");
}

/**
 * Calculate open hours for all visible periods
 */
async function calculateOpenHours(): Promise<OpenHoursResponse> {
	const now = new Date();

	// Find all currently visible periods (within visibility window and currently active)
	const visiblePeriods = await prisma.period.findMany({
		where: {
			AND: [
				{ visibleStart: { lte: now } },
				{ visibleEnd: { gte: now } },
				{ start: { lte: now } },
				{ end: { gte: now } },
			],
		},
		include: {
			periodExceptions: {
				orderBy: { start: "asc" },
			},
			shiftTypes: {
				include: {
					shiftSchedules: {
						select: {
							dayOfWeek: true,
							startTime: true,
							endTime: true,
						},
					},
				},
			},
		},
		orderBy: { start: "asc" },
	});

	const periods: PeriodHours[] = visiblePeriods.map((period) => {
		// Aggregate all shift schedules across all shift types in this period
		const schedulesByDay: Map<number, TimeRange[]> = new Map();

		// Initialize empty arrays for each day
		for (let day = 0; day < 7; day++) {
			schedulesByDay.set(day, []);
		}

		// Collect all shifts from all shift types
		for (const shiftType of period.shiftTypes) {
			for (const schedule of shiftType.shiftSchedules) {
				const ranges = schedulesByDay.get(schedule.dayOfWeek) ?? [];
				ranges.push({
					start: schedule.startTime,
					end: schedule.endTime,
				});
				schedulesByDay.set(schedule.dayOfWeek, ranges);
			}
		}

		// Build schedule for each day
		const schedule: DaySchedule[] = DAY_NAMES.map((dayName, dayOfWeek) => {
			const ranges = schedulesByDay.get(dayOfWeek) ?? [];
			const mergedRanges = mergeTimeRanges(ranges);

			return {
				dayOfWeek,
				dayName,
				ranges: mergedRanges,
				formattedHours: formatDayHours(mergedRanges),
			};
		});

		// Map exceptions (only future exceptions that are relevant)
		const exceptions: PeriodException[] = period.periodExceptions
			.filter((ex) => ex.end >= now)
			.map((ex) => ({
				name: ex.name,
				start: ex.start,
				end: ex.end,
			}));

		return {
			periodId: period.id,
			periodName: period.name,
			periodStart: period.start,
			periodEnd: period.end,
			schedule,
			exceptions,
		};
	});

	return {
		periods,
		cachedAt: now,
	};
}

/**
 * Check if the cache is valid
 */
function isCacheValid(): boolean {
	return (
		cachedOpenHours !== null && cacheExpiry !== null && new Date() < cacheExpiry
	);
}

/**
 * Public handler for open hours endpoint
 * Returns aggregated open hours for all visible periods
 */
export async function openHoursHandler(
	_options: TOpenHoursOptions,
): Promise<OpenHoursResponse> {
	// Check cache
	if (isCacheValid() && cachedOpenHours) {
		return cachedOpenHours;
	}

	// Calculate and cache
	cachedOpenHours = await calculateOpenHours();
	cacheExpiry = new Date(Date.now() + CACHE_DURATION_MS);

	return cachedOpenHours;
}
