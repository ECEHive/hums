/**
 * Format a number as hours with 2 decimal places
 */
export function formatHours(hours: number): string {
	return `${hours.toFixed(2)} hrs`;
}

/**
 * Format a percentage with 2 decimal places
 */
export function formatPercentage(percentage: number): string {
	return `${percentage.toFixed(2)}%`;
}

/**
 * Format a date for display
 */
export function formatDate(date: Date | null | undefined): string {
	if (!date) return "—";
	return new Date(date).toLocaleDateString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

/**
 * Format a date with time for display
 */
export function formatDateTime(date: Date | null | undefined): string {
	if (!date) return "—";
	return new Date(date).toLocaleString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	});
}

/**
 * Format duration in minutes to a human-readable string
 */
export function formatDuration(minutes: number): string {
	const hours = Math.floor(minutes / 60);
	const mins = Math.round(minutes % 60);
	if (hours === 0) return `${mins}m`;
	if (mins === 0) return `${hours}h`;
	return `${hours}h ${mins}m`;
}

/**
 * Days of week constant
 */
export const DAYS_OF_WEEK = [
	{ value: 0, label: "Sunday", short: "Sun" },
	{ value: 1, label: "Monday", short: "Mon" },
	{ value: 2, label: "Tuesday", short: "Tue" },
	{ value: 3, label: "Wednesday", short: "Wed" },
	{ value: 4, label: "Thursday", short: "Thu" },
	{ value: 5, label: "Friday", short: "Fri" },
	{ value: 6, label: "Saturday", short: "Sat" },
] as const;

/**
 * Convert 24-hour time string to 12-hour format
 */
export function formatTime(time: string): string {
	const [hours, minutes] = time.split(":").map(Number);
	const period = hours >= 12 ? "PM" : "AM";
	const hours12 = hours % 12 || 12;
	if (minutes === 0) {
		return `${hours12}${period}`;
	}
	return `${hours12}:${minutes.toString().padStart(2, "0")}${period}`;
}

/**
 * Parse a time string to get total minutes from midnight (for proper sorting)
 */
export function timeToMinutes(time: string): number {
	const [hours, minutes] = time.split(":").map(Number);
	return hours * 60 + minutes;
}

/**
 * Generate a formatted time slot string (e.g., "Sun 10:30AM-11AM")
 */
export function formatTimeSlot(
	dayOfWeek: number,
	startTime: string,
	endTime: string,
): string {
	const dayLabel = DAYS_OF_WEEK.find((d) => d.value === dayOfWeek)?.short ?? "";
	return `${dayLabel} ${formatTime(startTime)}-${formatTime(endTime)}`;
}

/**
 * Compare two time slots for sorting (correctly handles AM/PM ordering)
 */
export function compareTimeSlots(
	a: { dayOfWeek: number; startTime: string },
	b: { dayOfWeek: number; startTime: string },
): number {
	// First compare by day
	if (a.dayOfWeek !== b.dayOfWeek) {
		return a.dayOfWeek - b.dayOfWeek;
	}
	// Then compare by start time using minutes
	return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
}

/**
 * Escape HTML special characters
 */
export function escapeHtml(text: string): string {
	const map: Record<string, string> = {
		"&": "&amp;",
		"<": "&lt;",
		">": "&gt;",
		'"': "&quot;",
		"'": "&#39;",
	};
	return text.replace(/[&<>"']/g, (char) => map[char]);
}

/**
 * Generate a timestamp string for file naming
 */
export function generateTimestampForFilename(): string {
	const now = new Date();
	const pad = (n: number) => String(n).padStart(2, "0");
	const year = now.getFullYear();
	const month = pad(now.getMonth() + 1);
	const day = pad(now.getDate());
	const hours = pad(now.getHours());
	const minutes = pad(now.getMinutes());
	const seconds = pad(now.getSeconds());

	// timezone offset in minutes (getTimezoneOffset returns minutes behind UTC)
	const offsetMin = -now.getTimezoneOffset();
	const offsetSign = offsetMin >= 0 ? "+" : "-";
	const absOffset = Math.abs(offsetMin);
	const offsetHours = pad(Math.floor(absOffset / 60));
	const offsetMinutes = pad(absOffset % 60);
	const tz = `${offsetSign}${offsetHours}${offsetMinutes}`;

	return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}${tz}`;
}

/**
 * Generate date range presets based on the current date
 */
export function getStandardDatePresets(
	periodStart?: Date,
	periodEnd?: Date,
	periodName?: string,
) {
	const presets = [
		{
			id: "last2weeks",
			label: "Last 2 Full Weeks",
			getRange: () => {
				const now = new Date();
				const dayOfWeek = now.getDay();
				const lastSunday = new Date(
					now.getFullYear(),
					now.getMonth(),
					now.getDate() - dayOfWeek,
				);
				const startOfLast2Weeks = new Date(
					lastSunday.getFullYear(),
					lastSunday.getMonth(),
					lastSunday.getDate() - 14,
				);
				const endOfLast2Weeks = new Date(
					lastSunday.getFullYear(),
					lastSunday.getMonth(),
					lastSunday.getDate() - 1,
				);
				return { start: startOfLast2Weeks, end: endOfLast2Weeks };
			},
		},
		{
			id: "lastmonth",
			label: "Last Full Month",
			getRange: () => {
				const now = new Date();
				const firstDayOfLastMonth = new Date(
					now.getFullYear(),
					now.getMonth() - 1,
					1,
				);
				const lastDayOfLastMonth = new Date(
					now.getFullYear(),
					now.getMonth(),
					0,
				);
				return { start: firstDayOfLastMonth, end: lastDayOfLastMonth };
			},
		},
	];

	// Add period preset if period data is provided
	if (periodStart && periodEnd) {
		presets.push({
			id: "fullperiod",
			label: periodName ?? "Full Period",
			getRange: () => ({ start: periodStart, end: periodEnd }),
		});
	}

	return presets;
}
