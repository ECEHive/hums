/**
 * Utility types and functions for the admin schedule overview.
 * These are separate from shift-scheduler-utils to keep the admin
 * functionality isolated.
 */

export interface OverviewSchedule {
	id: number;
	shiftTypeId: number;
	shiftTypeName: string;
	shiftTypeColor: string | null;
	shiftTypeLocation: string;
	slots: number;
	dayOfWeek: number;
	startTime: string;
	endTime: string;
	users: { id: number; name: string }[];
	filledSlots: number;
	availableSlots: number;
}

export interface OverviewTimeBlock {
	total: number;
	filled: number;
	schedules: OverviewSchedule[];
}

/**
 * Parse a time string (HH:mm) to minutes since midnight.
 */
export function parseTimeToMinutes(time: string): number {
	const [hours, minutes] = time.split(":").map(Number);
	return hours * 60 + minutes;
}

/**
 * Format minutes since midnight to a compact time string.
 */
export function formatCompactTime(minutes: number): string {
	const hours24 = Math.floor(minutes / 60) % 24;
	const mins = minutes % 60;
	const period = hours24 >= 12 ? "PM" : "AM";
	const hours12 = hours24 % 12 || 12;
	const minutePart = mins === 0 ? "" : `:${mins.toString().padStart(2, "0")}`;
	return `${hours12}${minutePart} ${period}`;
}

/**
 * Calculate GCD for block size calculation.
 */
function gcd(a: number, b: number): number {
	return b === 0 ? a : gcd(b, a % b);
}

/**
 * Calculate optimal time block size based on schedule times.
 */
export function calculateBlockSize(schedules: OverviewSchedule[]): number {
	if (schedules.length === 0) return 30;

	const times: number[] = [];
	for (const schedule of schedules) {
		times.push(parseTimeToMinutes(schedule.startTime));
		times.push(parseTimeToMinutes(schedule.endTime));
	}

	const differences: number[] = [];
	for (let i = 0; i < times.length; i++) {
		for (let j = i + 1; j < times.length; j++) {
			const diff = Math.abs(times[i] - times[j]);
			if (diff > 0) differences.push(diff);
		}
	}

	if (differences.length === 0) return 30;

	let blockSize = differences[0];
	for (let i = 1; i < differences.length; i++) {
		blockSize = gcd(blockSize, differences[i]);
	}

	blockSize = Math.max(5, Math.min(60, blockSize));

	const commonIntervals = [5, 10, 15, 30, 60];
	for (const interval of commonIntervals) {
		if (blockSize <= interval && interval % blockSize === 0) {
			return interval;
		}
	}

	return blockSize;
}

/**
 * Group schedules by day and time block for grid display.
 */
export function groupSchedulesByDayAndTimeBlock(
	schedules: OverviewSchedule[],
	blockSize: number,
): Map<string, OverviewTimeBlock> {
	const blocks = new Map<string, OverviewTimeBlock>();

	for (const schedule of schedules) {
		const startMinutes = parseTimeToMinutes(schedule.startTime);
		const endMinutes = parseTimeToMinutes(schedule.endTime);
		const startBlock = Math.floor(startMinutes / blockSize) * blockSize;
		const endBlock = Math.floor((endMinutes - 1) / blockSize) * blockSize;

		for (
			let blockStart = startBlock;
			blockStart <= endBlock;
			blockStart += blockSize
		) {
			const key = `${schedule.dayOfWeek}-${blockStart}`;

			if (!blocks.has(key)) {
				blocks.set(key, {
					total: 0,
					filled: 0,
					schedules: [],
				});
			}
			const blockData = blocks.get(key);
			if (!blockData) continue;

			blockData.total += schedule.slots;
			blockData.filled += schedule.filledSlots;

			if (!blockData.schedules.find((s) => s.id === schedule.id)) {
				blockData.schedules.push(schedule);
			}
		}
	}

	return blocks;
}

export const DAYS_OF_WEEK = [
	{ value: 0, label: "Sunday", short: "Sun", letter: "S" },
	{ value: 1, label: "Monday", short: "Mon", letter: "M" },
	{ value: 2, label: "Tuesday", short: "Tue", letter: "T" },
	{ value: 3, label: "Wednesday", short: "Wed", letter: "W" },
	{ value: 4, label: "Thursday", short: "Thu", letter: "T" },
	{ value: 5, label: "Friday", short: "Fri", letter: "F" },
	{ value: 6, label: "Saturday", short: "Sat", letter: "S" },
];

/**
 * Get the current day of week (0-6, Sunday-Saturday).
 */
export function getCurrentDayOfWeek(): number {
	return new Date().getDay();
}

/**
 * Get current time in minutes since midnight.
 */
export function getCurrentTimeMinutes(): number {
	const now = new Date();
	return now.getHours() * 60 + now.getMinutes();
}

/**
 * Check if a time block contains the current time.
 */
export function isCurrentTimeBlock(
	blockStart: number,
	blockSize: number,
	dayOfWeek: number,
): boolean {
	const currentDay = getCurrentDayOfWeek();
	if (currentDay !== dayOfWeek) return false;

	const currentTime = getCurrentTimeMinutes();
	return currentTime >= blockStart && currentTime < blockStart + blockSize;
}
