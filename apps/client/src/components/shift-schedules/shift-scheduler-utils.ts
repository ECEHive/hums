export interface ShiftSchedule {
	id: number;
	shiftTypeId: number;
	shiftTypeName: string;
	shiftTypeColor: string | null;
	shiftTypeLocation: string;
	slots: number;
	dayOfWeek: number;
	startTime: string;
	endTime: string;
	availableSlots: number;
	isRegistered: boolean;
	canRegister: boolean;
	canUnregister?: boolean;
	canSelfAssign: boolean;
	meetsRoleRequirement: boolean;
	meetsBalancingRequirement: boolean;
	hasTimeOverlap: boolean;
	blockedByMaxRequirement?: boolean;
	users: { id: number; name: string }[];
}

export interface RequirementProgress {
	unit: "count" | "hours" | "minutes" | null;
	min: number | null;
	max: number | null;
	current: number;
	minPercent: number | null;
	maxPercent: number | null;
	hasReachedMax: boolean;
}

export interface TimeBlock {
	total: number;
	available: number;
	schedules: ShiftSchedule[];
	hasUserRegistered: boolean;
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

export const REQUIREMENT_UNIT_LABELS = {
	count: "shifts",
	hours: "hours",
	minutes: "minutes",
} as const;

export function parseTimeToMinutes(time: string): number {
	const [hours, minutes] = time.split(":").map(Number);
	return hours * 60 + minutes;
}

export function formatCompactTime(minutes: number): string {
	const hours24 = Math.floor(minutes / 60) % 24;
	const mins = minutes % 60;
	const period = hours24 >= 12 ? "PM" : "AM";
	const hours12 = hours24 % 12 || 12;
	const minutePart = mins === 0 ? "" : `:${mins.toString().padStart(2, "0")}`;
	return `${hours12}${minutePart} ${period}`;
}

function gcd(a: number, b: number): number {
	return b === 0 ? a : gcd(b, a % b);
}

export function calculateBlockSize(schedules: ShiftSchedule[]): number {
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

export function groupSchedulesByDayAndTimeBlock(
	schedules: ShiftSchedule[],
	blockSize: number,
): Map<string, TimeBlock> {
	const blocks = new Map<string, TimeBlock>();

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
					available: 0,
					schedules: [],
					hasUserRegistered: false,
				});
			}
			const blockData = blocks.get(key);
			if (!blockData) continue;

			blockData.total += schedule.slots;
			blockData.available += schedule.availableSlots;
			if (schedule.isRegistered) {
				blockData.hasUserRegistered = true;
			}

			if (!blockData.schedules.find((s) => s.id === schedule.id)) {
				blockData.schedules.push(schedule);
			}
		}
	}

	return blocks;
}
