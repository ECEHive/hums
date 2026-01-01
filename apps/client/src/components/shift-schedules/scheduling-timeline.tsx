import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
	HoverCard,
	HoverCardContent,
	HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Spinner } from "@/components/ui/spinner";
import {
	getAppTimezoneAbbreviation,
	isUserInAppTimezone,
} from "@/lib/timezone";
import { cn } from "@/lib/utils";

interface ShiftSchedule {
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
	hasTimeOverlap?: boolean;
}

interface SchedulingTimelineProps {
	schedules: ShiftSchedule[];
	isLoading: boolean;
	onBlockClick: (dayOfWeek: number, timeBlock: string) => void;
}

const DAYS_OF_WEEK = [
	{ value: 0, label: "Sunday", short: "Sun" },
	{ value: 1, label: "Monday", short: "Mon" },
	{ value: 2, label: "Tuesday", short: "Tue" },
	{ value: 3, label: "Wednesday", short: "Wed" },
	{ value: 4, label: "Thursday", short: "Thu" },
	{ value: 5, label: "Friday", short: "Fri" },
	{ value: 6, label: "Saturday", short: "Sat" },
];

const TIME_COLUMN_WIDTH = "clamp(68px, 18vw, 120px)";
const DAY_COLUMN_WIDTH = "clamp(110px, 14vw, 160px)";
const TIME_HEADER_LABEL = isUserInAppTimezone
	? "Time"
	: `Time (${getAppTimezoneAbbreviation()})`;

function renderEmptyState(
	message = "No shift schedules available for this period",
) {
	return (
		<Card>
			<CardContent className="py-12 text-center text-muted-foreground">
				{message}
			</CardContent>
		</Card>
	);
}

function formatCompactTime(minutes: number): string {
	const hours24 = Math.floor(minutes / 60) % 24;
	const mins = minutes % 60;
	const period = hours24 >= 12 ? "p" : "a";
	const hours12 = hours24 % 12 || 12;
	const minutePart = mins === 0 ? "" : `:${mins.toString().padStart(2, "0")}`;
	return `${hours12}${minutePart}${period}`;
}

/**
 * Parse time string (HH:MM) to minutes since midnight
 */
function parseTimeToMinutes(time: string): number {
	const [hours, minutes] = time.split(":").map(Number);
	return hours * 60 + minutes;
}

/**
 * Find the greatest common divisor of two numbers
 */
function gcd(a: number, b: number): number {
	return b === 0 ? a : gcd(b, a % b);
}

/**
 * Calculate the optimal block size based on shift durations and offsets
 */
function calculateBlockSize(schedules: ShiftSchedule[]): number {
	if (schedules.length === 0) return 30;

	const times: number[] = [];

	// Collect all start and end times in minutes
	for (const schedule of schedules) {
		times.push(parseTimeToMinutes(schedule.startTime));
		times.push(parseTimeToMinutes(schedule.endTime));
	}

	// Calculate all differences (durations and offsets)
	const differences: number[] = [];
	for (let i = 0; i < times.length; i++) {
		for (let j = i + 1; j < times.length; j++) {
			const diff = Math.abs(times[i] - times[j]);
			if (diff > 0) {
				differences.push(diff);
			}
		}
	}

	if (differences.length === 0) return 30;

	// Find GCD of all differences
	let blockSize = differences[0];
	for (let i = 1; i < differences.length; i++) {
		blockSize = gcd(blockSize, differences[i]);
	}

	// Ensure block size is reasonable (between 5 and 60 minutes)
	blockSize = Math.max(5, Math.min(60, blockSize));

	// Prefer common intervals: 5, 10, 15, 30, 60
	const commonIntervals = [5, 10, 15, 30, 60];
	for (const interval of commonIntervals) {
		if (blockSize <= interval && interval % blockSize === 0) {
			return interval;
		}
	}

	return blockSize;
}

/**
 * Format minutes to HH:MM time string
 */
function formatTimeFromMinutes(minutes: number): string {
	const hours = Math.floor(minutes / 60);
	const mins = minutes % 60;
	return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
}

/**
 * Format day of week number to string
 */
function formatDayBlock(dayOfWeek: number): string {
	const day = DAYS_OF_WEEK.find((d) => d.value === dayOfWeek);
	return day ? day.label : "Day";
}

/**
 * Format time block for display (h:MM AM/PM)
 */
function formatTimeBlock(minutes: number, blockSize: number): string {
	const endMinutes = minutes + blockSize;
	const startHours = Math.floor(minutes / 60);
	const startMins = minutes % 60;
	const endHours = Math.floor(endMinutes / 60);
	const endMins = endMinutes % 60;

	const startPeriod = startHours >= 12 ? "PM" : "AM";
	const endPeriod = endHours >= 12 ? "PM" : "AM";
	const startDisplayHours =
		startHours === 0 ? 12 : startHours > 12 ? startHours - 12 : startHours;
	const endDisplayHours =
		endHours === 0 ? 12 : endHours > 12 ? endHours - 12 : endHours;

	return `${startDisplayHours}:${startMins.toString().padStart(2, "0")} ${startPeriod} - ${endDisplayHours}:${endMins.toString().padStart(2, "0")} ${endPeriod}`;
}

/**
 * Group schedules by day and time block
 */
function groupSchedulesByDayAndTimeBlock(
	schedules: ShiftSchedule[],
	blockSize: number,
): Map<
	string,
	{
		total: number;
		available: number;
		schedules: ShiftSchedule[];
		hasUserRegistered: boolean;
	}
> {
	const blocks = new Map<
		string,
		{
			total: number;
			available: number;
			schedules: ShiftSchedule[];
			hasUserRegistered: boolean;
		}
	>();

	for (const schedule of schedules) {
		const startMinutes = parseTimeToMinutes(schedule.startTime);
		const endMinutes = parseTimeToMinutes(schedule.endTime);

		// Find all blocks this schedule overlaps with
		const startBlock = Math.floor(startMinutes / blockSize) * blockSize;
		const endBlock = Math.floor((endMinutes - 1) / blockSize) * blockSize;

		for (
			let blockStart = startBlock;
			blockStart <= endBlock;
			blockStart += blockSize
		) {
			// Use a composite key: "dayOfWeek-blockStartMinutes"
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

			// Only add the schedule once per block
			if (!blockData.schedules.find((s) => s.id === schedule.id)) {
				blockData.schedules.push(schedule);
			}
		}
	}

	return blocks;
}

function compareShiftSchedules(a: ShiftSchedule, b: ShiftSchedule) {
	const nameCompare = a.shiftTypeName.localeCompare(b.shiftTypeName);
	if (nameCompare !== 0) return nameCompare;

	const locationCompare = (a.shiftTypeLocation ?? "").localeCompare(
		b.shiftTypeLocation ?? "",
	);
	if (locationCompare !== 0) return locationCompare;

	const dayCompare = a.dayOfWeek - b.dayOfWeek;
	if (dayCompare !== 0) return dayCompare;

	const timeCompare = a.startTime.localeCompare(b.startTime);
	if (timeCompare !== 0) return timeCompare;

	return a.id - b.id;
}

export function SchedulingTimeline({
	schedules,
	isLoading,
	onBlockClick,
}: SchedulingTimelineProps) {
	const sortedSchedules = React.useMemo(
		() => [...schedules].sort(compareShiftSchedules),
		[schedules],
	);
	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-12">
				<Spinner className="w-8 h-8" />
			</div>
		);
	}

	if (schedules.length === 0) {
		return renderEmptyState();
	}

	// Calculate optimal block size
	const blockSize = calculateBlockSize(sortedSchedules);

	// Group schedules by day and time block
	const blocks = groupSchedulesByDayAndTimeBlock(sortedSchedules, blockSize);

	// Determine which days actually have shift schedules
	const daysWithSchedules = new Set(
		sortedSchedules.map((schedule) => schedule.dayOfWeek),
	);
	const visibleDays = DAYS_OF_WEEK.filter((day) =>
		daysWithSchedules.has(day.value),
	);

	if (visibleDays.length === 0) {
		return renderEmptyState();
	}

	// Get all unique time blocks across all days
	const allTimeBlocks = new Set<number>();
	for (const key of blocks.keys()) {
		const [_day, timeStr] = key.split("-");
		allTimeBlocks.add(Number.parseInt(timeStr, 10));
	}
	const timeBlockStarts = Array.from(allTimeBlocks).sort((a, b) => a - b);

	if (timeBlockStarts.length === 0) {
		return renderEmptyState("No shift schedules available");
	}

	const gridTemplateColumns = `${TIME_COLUMN_WIDTH} repeat(${visibleDays.length}, ${DAY_COLUMN_WIDTH})`;

	return (
		<div className="relative w-full">
			{/* Container with max height and shadow indicators */}
			<div className="relative rounded-lg border bg-card overflow-hidden shadow-sm">
				{/* Main scrollable container */}
				<div className="overflow-auto max-h-[calc(100vh-20rem)] sm:max-h-[calc(100vh-24rem)] min-h-[400px] sm:min-h-[500px] scroll-smooth scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
					<div className="min-w-max">
						{/* Grid container */}
						<div
							className="grid auto-rows-min gap-2 p-3"
							style={{ gridTemplateColumns }}
						>
							{/* Sticky header row - time label */}
							<div className="sticky top-0 left-0 z-50 bg-card py-2 pr-4 border-b-2 border-primary/20">
								<div className="text-xs sm:text-sm font-semibold text-muted-foreground uppercase tracking-wide">
									{TIME_HEADER_LABEL}
								</div>
							</div>

							{/* Sticky header row - day headers */}
							{visibleDays.map((day) => (
								<div
									key={`header-${day.value}`}
									className="sticky top-0 z-40 bg-card py-2 border-b-2 border-primary/20"
								>
									<div className="text-center font-semibold text-foreground">
										<div className="hidden sm:block text-sm">{day.label}</div>
										<div className="sm:hidden text-xs">{day.short}</div>
									</div>
								</div>
							))}

							{/* Time blocks and shift cells */}
							{timeBlockStarts.map((blockStart) => {
								const timeLabel = formatTimeBlock(blockStart, blockSize);
								const compactStart = formatCompactTime(blockStart);
								const compactEnd = formatCompactTime(blockStart + blockSize);

								return (
									<React.Fragment key={blockStart}>
										{/* Sticky time label */}
										<div className="sticky left-0 z-30 bg-card/95 backdrop-blur-sm py-2 pr-4 min-h-[60px] flex items-center border-r border-border/50">
											<div className="text-muted-foreground font-medium text-xs sm:text-sm">
												<span className="hidden sm:inline">{timeLabel}</span>
												<span className="flex flex-col sm:hidden leading-tight">
													<span className="font-semibold">{compactStart}</span>
													<span className="text-[10px] text-muted-foreground/80">
														{compactEnd}
													</span>
												</span>
											</div>
										</div>

										{/* Shift cells for each day */}
										{visibleDays.map((day) => {
											const key = `${day.value}-${blockStart}`;
											const blockData = blocks.get(key);

											if (!blockData) {
												return (
													<div
														key={key}
														className="border border-dashed border-muted/50 rounded-md p-2 min-h-[60px]"
													/>
												);
											}

											const hasAvailable = blockData.available > 0;
											const isFull = blockData.available === 0;
											const isRegistered = blockData.hasUserRegistered;

											// Determine background and border colors
											let bgClass = "bg-muted/30";
											let borderClass = "border-muted";
											let textClass = "text-muted-foreground";
											let hoverClass = "hover:bg-muted/50";

											if (isRegistered) {
												bgClass = "bg-primary";
												borderClass = "border-primary";
												textClass = "text-primary-foreground";
												hoverClass = "hover:bg-primary/90";
											} else if (hasAvailable) {
												bgClass = "bg-green-50 dark:bg-green-950";
												borderClass = "border-green-500 dark:border-green-600";
												textClass = "text-green-700 dark:text-green-300";
												hoverClass =
													"hover:bg-green-100 dark:hover:bg-green-900 hover:border-green-600 dark:hover:border-green-500";
											} else if (isFull) {
												bgClass = "bg-muted/50";
												borderClass = "border-muted";
												textClass = "text-muted-foreground";
												hoverClass = "hover:bg-muted/60";
											}

											return (
												<HoverCard key={key}>
													<HoverCardTrigger asChild>
														<Button
															variant="outline"
															className={cn(
																"w-full h-auto min-h-[60px] flex flex-row items-center justify-between gap-2 px-2 sm:px-3 py-2 transition-all active:scale-95",
																bgClass,
																borderClass,
																hoverClass,
																isFull && !isRegistered && "opacity-60",
															)}
															onClick={() =>
																onBlockClick(
																	day.value,
																	formatTimeFromMinutes(blockStart),
																)
															}
														>
															{/* Left side: number and status */}
															<div className="flex items-center gap-1.5 sm:gap-2">
																<div
																	className={cn(
																		"text-xl sm:text-2xl font-bold tabular-nums",
																		textClass,
																	)}
																>
																	{blockData.available}
																</div>
																<div
																	className={cn(
																		"text-[10px] sm:text-xs font-medium",
																		textClass,
																	)}
																>
																	{isRegistered
																		? "Reg."
																		: hasAvailable
																			? "Open"
																			: "Full"}
																</div>
															</div>

															{/* Right side: registered checkmark */}
															{isRegistered && (
																<div
																	className={cn(
																		"text-base sm:text-lg font-bold",
																		textClass,
																	)}
																>
																	✓
																</div>
															)}
														</Button>
													</HoverCardTrigger>
													<HoverCardContent className="w-80">
														<div className="space-y-2">
															<div className="font-medium mb-2 text-sm">
																{formatDayBlock(day.value)} —{" "}
																{formatTimeBlock(blockStart, blockSize)}
															</div>
															{blockData.schedules.map((schedule) => (
																<div
																	key={schedule.id}
																	className="flex items-center justify-between gap-4 text-sm"
																>
																	<div className="flex items-center gap-2 flex-1">
																		{schedule.shiftTypeColor && (
																			<div
																				className="w-3 h-3 rounded-full border"
																				style={{
																					backgroundColor:
																						schedule.shiftTypeColor,
																				}}
																			/>
																		)}
																		<span className="font-medium">
																			{schedule.shiftTypeName}
																		</span>
																	</div>
																	<div className="text-muted-foreground tabular-nums">
																		{schedule.availableSlots} / {schedule.slots}
																	</div>
																</div>
															))}
														</div>
													</HoverCardContent>
												</HoverCard>
											);
										})}
									</React.Fragment>
								);
							})}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
