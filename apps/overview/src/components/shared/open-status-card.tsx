import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { Clock } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface TimeRange {
	start: string;
	end: string;
}

interface DaySchedule {
	dayOfWeek: number;
	dayName: string;
	ranges: TimeRange[];
	formattedHours: string;
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

const MAX_COUNTDOWN_HOURS = 24;

const DAY_NAMES = [
	"Sunday",
	"Monday",
	"Tuesday",
	"Wednesday",
	"Thursday",
	"Friday",
	"Saturday",
];

/**
 * Parse time string (HH:mm) to minutes since midnight
 */
function timeToMinutes(time: string): number {
	// Validate format HH:mm (zero-padded) before parsing
	if (typeof time !== "string" || !/^\d{2}:\d{2}$/.test(time)) {
		return NaN;
	}

	const [hoursStr, minutesStr] = time.split(":");
	const hours = Number(hoursStr);
	const minutes = Number(minutesStr);

	// Ensure numeric values are integers within valid time ranges
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
 * Check if current time is within a time range
 */
function isTimeInRange(currentMinutes: number, range: TimeRange): boolean {
	const startMinutes = timeToMinutes(range.start);
	const endMinutes = timeToMinutes(range.end);
	return currentMinutes >= startMinutes && currentMinutes < endMinutes;
}

/**
 * Check if current date falls within an exception period
 */
function isInException(
	now: Date,
	exceptions: PeriodException[],
): PeriodException | null {
	for (const exception of exceptions) {
		// Create new Date objects to avoid mutating the original exception dates
		const exStart = new Date(exception.start);
		const exEnd = new Date(exception.end);
		// Set time bounds on the cloned dates
		const startOfDay = new Date(exStart);
		startOfDay.setHours(0, 0, 0, 0);
		const endOfDay = new Date(exEnd);
		endOfDay.setHours(23, 59, 59, 999);
		if (now >= startOfDay && now <= endOfDay) {
			return exception;
		}
	}
	return null;
}

interface TransitionInfo {
	minutesUntil: number;
	type: "opening" | "closing";
	openingTime?: string; // HH:mm format for the opening time
	openingDayOfWeek?: number; // Day of week (0-6) for the opening
	openingDate?: Date; // Actual date of the opening
}

/**
 * Find the next opening or closing time
 * Now handles future periods and calculates exact opening dates
 */
function findNextTransition(
	data: OpenHoursResponse | undefined,
	isCurrentlyOpen: boolean,
): TransitionInfo | null {
	if (!data || data.periods.length === 0) {
		return null;
	}

	const now = new Date();
	const currentDayOfWeek = now.getDay();
	const currentMinutes = now.getHours() * 60 + now.getMinutes();

	let bestTransition: TransitionInfo | null = null;

	// Check each period for transitions
	for (const period of data.periods) {
		// Skip if in exception
		if (isInException(now, period.exceptions)) {
			continue;
		}

		const periodStart = new Date(period.periodStart);
		const periodEnd = new Date(period.periodEnd);

		// Period hasn't started yet - find when it opens
		if (now < periodStart) {
			// Find the first day with a schedule at or after the period start
			const periodStartDay = periodStart.getDay();
			const periodStartMinutes =
				periodStart.getHours() * 60 + periodStart.getMinutes();

			// Check each day starting from period start day
			for (let dayOffset = 0; dayOffset <= 7; dayOffset++) {
				const checkDayOfWeek = (periodStartDay + dayOffset) % 7;
				const daySchedule = period.schedule.find(
					(s) => s.dayOfWeek === checkDayOfWeek,
				);
				if (daySchedule && daySchedule.ranges.length > 0) {
					for (const range of daySchedule.ranges) {
						const openMinutes = timeToMinutes(range.start);

						// Calculate the actual opening date
						const openingDate = new Date(periodStart);
						openingDate.setDate(periodStart.getDate() + dayOffset);
						openingDate.setHours(
							Math.floor(openMinutes / 60),
							openMinutes % 60,
							0,
							0,
						);

						// Skip if this opening is before the period actually starts
						if (dayOffset === 0 && openMinutes < periodStartMinutes) {
							continue;
						}

						const minutesUntilOpen = Math.floor(
							(openingDate.getTime() - now.getTime()) / (1000 * 60),
						);

						if (
							minutesUntilOpen > 0 &&
							(!bestTransition ||
								minutesUntilOpen < bestTransition.minutesUntil)
						) {
							bestTransition = {
								minutesUntil: minutesUntilOpen,
								type: "opening",
								openingTime: range.start,
								openingDayOfWeek: openingDate.getDay(),
								openingDate,
							};
						}
						// Found the first opening for this day, move to next day
						break;
					}
				}
			}
			continue;
		}

		// Period has ended - skip it
		if (now > periodEnd) {
			continue;
		}

		// Period is active - find transitions within the period
		const todaySchedule = period.schedule.find(
			(s) => s.dayOfWeek === currentDayOfWeek,
		);

		if (!todaySchedule || todaySchedule.ranges.length === 0) {
			// Closed today, find next opening day
			for (let dayOffset = 1; dayOffset <= 7; dayOffset++) {
				const nextDayOfWeek = (currentDayOfWeek + dayOffset) % 7;
				const nextDaySchedule = period.schedule.find(
					(s) => s.dayOfWeek === nextDayOfWeek,
				);
				if (nextDaySchedule && nextDaySchedule.ranges.length > 0) {
					const firstRange = nextDaySchedule.ranges[0];
					const openMinutes = timeToMinutes(firstRange.start);
					const minutesUntil =
						dayOffset * 24 * 60 - currentMinutes + openMinutes;

					// Calculate the actual opening date
					const openingDate = new Date(now);
					openingDate.setDate(now.getDate() + dayOffset);
					openingDate.setHours(
						Math.floor(openMinutes / 60),
						openMinutes % 60,
						0,
						0,
					);

					if (!bestTransition || minutesUntil < bestTransition.minutesUntil) {
						bestTransition = {
							minutesUntil,
							type: "opening",
							openingTime: firstRange.start,
							openingDayOfWeek: nextDayOfWeek,
							openingDate,
						};
						// Found the earliest opening for this period, no need to check further days
						break;
					}
				}
			}
			continue;
		}

		// We have a schedule for today - find the next transition
		if (isCurrentlyOpen) {
			// Find when we close - check all ranges to find which one we're in
			// or the next closing time
			let foundClosingForThisPeriod = false;
			for (const range of todaySchedule.ranges) {
				const startMinutes = timeToMinutes(range.start);
				const endMinutes = timeToMinutes(range.end);

				// If we're currently in this range, return time until it ends
				if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
					const minutesUntil = endMinutes - currentMinutes;
					if (!bestTransition || minutesUntil < bestTransition.minutesUntil) {
						bestTransition = { minutesUntil, type: "closing" };
					}
					foundClosingForThisPeriod = true;
					break;
				}

				// If this range ends after current time, it might be a closing time
				// (for cases where ranges overlap or there's a gap we're in)
				if (endMinutes > currentMinutes && startMinutes <= currentMinutes) {
					const minutesUntil = endMinutes - currentMinutes;
					if (!bestTransition || minutesUntil < bestTransition.minutesUntil) {
						bestTransition = { minutesUntil, type: "closing" };
					}
					foundClosingForThisPeriod = true;
					break;
				}
			}

			// If still open but couldn't find closing time in current ranges,
			// find the last range that ends today
			if (!foundClosingForThisPeriod) {
				const endTimes = todaySchedule.ranges
					.map((r) => timeToMinutes(r.end))
					.filter((end) => end > currentMinutes);
				if (endTimes.length > 0) {
					const nextEnd = Math.min(...endTimes);
					const minutesUntil = nextEnd - currentMinutes;
					if (!bestTransition || minutesUntil < bestTransition.minutesUntil) {
						bestTransition = { minutesUntil, type: "closing" };
					}
				}
			}
		} else {
			// Find next opening time today
			let foundToday = false;
			for (const range of todaySchedule.ranges) {
				const startMinutes = timeToMinutes(range.start);
				if (currentMinutes < startMinutes) {
					const minutesUntil = startMinutes - currentMinutes;
					if (!bestTransition || minutesUntil < bestTransition.minutesUntil) {
						const openingDate = new Date(now);
						openingDate.setHours(
							Math.floor(startMinutes / 60),
							startMinutes % 60,
							0,
							0,
						);

						bestTransition = {
							minutesUntil,
							type: "opening",
							openingTime: range.start,
							openingDayOfWeek: currentDayOfWeek,
							openingDate,
						};
					}
					foundToday = true;
					break;
				}
			}

			// All today's ranges have passed, check tomorrow and following days
			if (!foundToday) {
				for (let dayOffset = 1; dayOffset <= 7; dayOffset++) {
					const nextDayOfWeek = (currentDayOfWeek + dayOffset) % 7;
					const nextDaySchedule = period.schedule.find(
						(s) => s.dayOfWeek === nextDayOfWeek,
					);
					if (nextDaySchedule && nextDaySchedule.ranges.length > 0) {
						const firstRange = nextDaySchedule.ranges[0];
						const openMinutes = timeToMinutes(firstRange.start);
						const minutesUntil =
							dayOffset * 24 * 60 - currentMinutes + openMinutes;

						if (!bestTransition || minutesUntil < bestTransition.minutesUntil) {
							const openingDate = new Date(now);
							openingDate.setDate(now.getDate() + dayOffset);
							openingDate.setHours(
								Math.floor(openMinutes / 60),
								openMinutes % 60,
								0,
								0,
							);

							bestTransition = {
								minutesUntil,
								type: "opening",
								openingTime: firstRange.start,
								openingDayOfWeek: nextDayOfWeek,
								openingDate,
							};
							// Found the earliest opening for this period, no need to check further days
							break;
						}
					}
				}
			}
		}
	}

	return bestTransition;
}

/**
 * Format minutes into a human-readable countdown string
 */
function formatCountdown(minutes: number): string {
	if (minutes < 60) {
		return `${minutes} minute${minutes !== 1 ? "s" : ""}`;
	}
	const hours = Math.floor(minutes / 60);
	const remainingMinutes = minutes % 60;
	if (remainingMinutes === 0) {
		return `${hours} hour${hours !== 1 ? "s" : ""}`;
	}
	return `${hours}h ${remainingMinutes}m`;
}

/**
 * Format time string (HH:mm) to 12-hour format (e.g., "6:00am")
 */
function formatTime12Hour(time: string): string {
	const minutes = timeToMinutes(time);
	if (Number.isNaN(minutes)) return "Invalid time";

	const hours = Math.floor(minutes / 60);
	const mins = minutes % 60;
	const period = hours >= 12 ? "pm" : "am";
	const hour12 = hours % 12 || 12;
	return `${hour12}:${mins.toString().padStart(2, "0")}${period}`;
}

/**
 * Format the opening message based on how far away it is
 * - Less than 24 hours: "Opening in X hours"
 * - Within 7 days: "Opening Tuesday 6:00am"
 * - More than 7 days: "Opening Jan 27 6:00am"
 */
function formatOpeningMessage(transition: TransitionInfo): string | null {
	const maxMinutes = MAX_COUNTDOWN_HOURS * 60;
	const maxMinutesForDayName = 7 * 24 * 60; // 7 days in minutes

	if (transition.minutesUntil <= maxMinutes) {
		const timeStr = formatCountdown(transition.minutesUntil);
		return `Opening in ${timeStr}`;
	}

	// More than 24 hours away - show day/date and time
	if (transition.openingTime && transition.openingDate) {
		const timeStr = formatTime12Hour(transition.openingTime);

		// If within 7 days, show day name; otherwise show the date
		if (
			transition.minutesUntil <= maxMinutesForDayName &&
			transition.openingDayOfWeek !== undefined
		) {
			const dayName = DAY_NAMES[transition.openingDayOfWeek];
			return `Opening ${dayName} ${timeStr}`;
		}

		// More than 7 days away - show the date
		const dateStr = dayjs(transition.openingDate).format("MMM D");
		return `Opening ${dateStr} ${timeStr}`;
	}

	// Fallback if we don't have the opening info
	return null;
}

/**
 * Calculate if currently open based on periods data
 */
function calculateOpenStatus(data: OpenHoursResponse | undefined): {
	isOpen: boolean;
	currentException: PeriodException | null;
} {
	if (!data || data.periods.length === 0) {
		return { isOpen: false, currentException: null };
	}

	const now = new Date();
	const currentDayOfWeek = now.getDay();
	const currentMinutes = now.getHours() * 60 + now.getMinutes();

	for (const period of data.periods) {
		const exception = isInException(now, period.exceptions);
		if (exception) {
			return { isOpen: false, currentException: exception };
		}

		const periodStart = new Date(period.periodStart);
		const periodEnd = new Date(period.periodEnd);
		if (now < periodStart || now > periodEnd) {
			continue;
		}

		const todaySchedule = period.schedule.find(
			(s) => s.dayOfWeek === currentDayOfWeek,
		);
		if (todaySchedule && todaySchedule.ranges.length > 0) {
			for (const range of todaySchedule.ranges) {
				if (isTimeInRange(currentMinutes, range)) {
					return { isOpen: true, currentException: null };
				}
			}
		}
	}

	return { isOpen: false, currentException: null };
}

/**
 * Format a date range for display
 */
function formatDateRange(start: Date, end: Date): string {
	const startDate = dayjs(start);
	const endDate = dayjs(end);
	return `${startDate.format("MMM D, YYYY")} - ${endDate.format("MMM D, YYYY")}`;
}

/**
 * Format exception date range for display
 */
function formatExceptionDate(start: Date, end: Date): string {
	const startDate = dayjs(start);
	const endDate = dayjs(end);

	if (startDate.isSame(endDate, "day")) {
		return startDate.format("MM/DD/YYYY");
	}
	return `${startDate.format("MM/DD/YYYY")} - ${endDate.format("MM/DD/YYYY")}`;
}

/**
 * Schedule content displayed in the dialog
 */
function ScheduleContent({ periods }: { periods: PeriodHours[] }) {
	const currentDayOfWeek = new Date().getDay();

	return (
		<div className="space-y-6">
			{periods.map((period) => (
				<div key={period.periodId} className="space-y-2">
					<div className="font-semibold text-base">
						{period.periodName} Hours
					</div>
					<div className="text-muted-foreground text-xs">
						{formatDateRange(period.periodStart, period.periodEnd)}
					</div>
					<div className="space-y-1 mt-2">
						{period.schedule.map((day) => (
							<div
								key={day.dayOfWeek}
								className={cn(
									"flex justify-between py-1",
									day.dayOfWeek === currentDayOfWeek &&
										"font-medium bg-accent/50 -mx-2 px-2 rounded",
								)}
							>
								<span>{day.dayName}:</span>
								<span
									className={cn(
										day.formattedHours === "Closed" && "text-muted-foreground",
									)}
								>
									{day.formattedHours}
								</span>
							</div>
						))}
					</div>

					{period.exceptions.length > 0 && (
						<div className="mt-4 pt-2 border-t">
							<div className="font-medium text-sm mb-2">Exceptions:</div>
							<div className="space-y-1 text-xs">
								{period.exceptions.map((exception, idx) => (
									<div key={idx} className="text-muted-foreground">
										{formatExceptionDate(exception.start, exception.end)}:{" "}
										{exception.name}
									</div>
								))}
							</div>
						</div>
					)}
				</div>
			))}
		</div>
	);
}

export function OpenStatusCard() {
	const [tick, setTick] = useState(0);

	const { data, isLoading } = useQuery({
		queryKey: ["overview", "openHours"],
		queryFn: () => trpc.overview.openHours.query({}),
		refetchInterval: 30 * 1000, // Refresh every 30 seconds
	});

	// Re-calculate status every 30 seconds for real-time updates
	useEffect(() => {
		const interval = setInterval(() => setTick((t) => t + 1), 30 * 1000);
		return () => clearInterval(interval);
	}, []);

	const { isOpen, currentException } = useMemo(
		() => calculateOpenStatus(data as OpenHoursResponse | undefined),
		[data, tick],
	);

	const transition = useMemo(
		() => findNextTransition(data as OpenHoursResponse | undefined, isOpen),
		[data, isOpen, tick],
	);

	const countdownMessage = useMemo(() => {
		if (!transition) return null;

		if (transition.type === "closing") {
			const maxMinutes = MAX_COUNTDOWN_HOURS * 60;
			if (transition.minutesUntil > maxMinutes) return null;
			const timeStr = formatCountdown(transition.minutesUntil);
			return `Closing in ${timeStr}`;
		}

		// For opening, use the new formatting function that handles >24h case
		return formatOpeningMessage(transition);
	}, [transition]);

	if (isLoading) {
		return (
			<Card>
				<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
					<CardTitle className="text-sm font-medium">Current Status</CardTitle>
					<Clock className="h-4 w-4 text-muted-foreground" />
				</CardHeader>
				<CardContent>
					<Skeleton className="h-10 w-24" />
					<Skeleton className="h-4 w-32 mt-2" />
				</CardContent>
			</Card>
		);
	}

	const hasSchedule = data && data.periods.length > 0;

	return (
		<Dialog>
			<DialogTrigger asChild>
				<Card
					className={cn(
						"cursor-pointer transition-colors hover:bg-accent/50",
						hasSchedule && "hover:bg-accent/30",
					)}
				>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">
							Current Status
						</CardTitle>
						<Clock className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div
							className={cn(
								"text-3xl md:text-4xl font-bold",
								isOpen
									? "text-green-600 dark:text-green-500"
									: "text-red-600 dark:text-red-500",
							)}
						>
							{isOpen ? "Open" : "Closed"}
						</div>
						{currentException && (
							<p className="text-xs md:text-sm text-muted-foreground mt-1">
								{currentException.name}
							</p>
						)}
						{countdownMessage && !currentException && (
							<p className="text-xs md:text-sm text-muted-foreground mt-1">
								{countdownMessage}
							</p>
						)}
						{!hasSchedule && (
							<p className="text-xs md:text-sm text-muted-foreground">
								No schedule available
							</p>
						)}
						{hasSchedule && !countdownMessage && !currentException && (
							<p className="text-xs md:text-sm text-muted-foreground">
								Tap to see hours
							</p>
						)}
					</CardContent>
				</Card>
			</DialogTrigger>
			{hasSchedule && (
				<DialogContent className="max-h-[85vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>Hours</DialogTitle>
						<DialogDescription>Our regular operating hours</DialogDescription>
					</DialogHeader>
					<ScheduleContent periods={data.periods} />
				</DialogContent>
			)}
		</Dialog>
	);
}
