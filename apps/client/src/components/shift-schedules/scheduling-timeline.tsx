import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
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

export function SchedulingTimeline({
	schedules,
	isLoading,
	onBlockClick,
}: SchedulingTimelineProps) {
	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-12">
				<Spinner className="w-8 h-8" />
			</div>
		);
	}

	if (schedules.length === 0) {
		return (
			<Card>
				<CardContent className="py-12 text-center text-muted-foreground">
					No shift schedules available for this period
				</CardContent>
			</Card>
		);
	}

	// Calculate optimal block size
	const blockSize = calculateBlockSize(schedules);

	// Group schedules by day and time block
	const blocks = groupSchedulesByDayAndTimeBlock(schedules, blockSize);

	// Get all unique time blocks across all days
	const allTimeBlocks = new Set<number>();
	for (const key of blocks.keys()) {
		const [_day, timeStr] = key.split("-");
		allTimeBlocks.add(Number.parseInt(timeStr, 10));
	}
	const timeBlockStarts = Array.from(allTimeBlocks).sort((a, b) => a - b);

	if (timeBlockStarts.length === 0) {
		return (
			<Card>
				<CardContent className="py-12 text-center text-muted-foreground">
					No shift schedules available
				</CardContent>
			</Card>
		);
	}

	return (
		<div className="overflow-x-auto w-full pb-4">
			<div className="min-w-max">
				{/* Header row with day names */}
				<div className="grid grid-cols-8 gap-2 mb-2">
					<div className="text-sm font-medium text-muted-foreground">Time</div>
					{DAYS_OF_WEEK.map((day) => (
						<div key={day.value} className="text-sm font-medium text-center">
							<div className="hidden sm:block">{day.label}</div>
							<div className="sm:hidden">{day.short}</div>
						</div>
					))}
				</div>

				{/* Timeline grid */}
				<div className="space-y-2">
					{timeBlockStarts.map((blockStart) => {
						const timeLabel = formatTimeBlock(blockStart, blockSize);

						return (
							<div key={blockStart} className="grid grid-cols-8 gap-2">
								{/* Time label */}
								<div className="flex items-center text-sm text-muted-foreground font-medium py-2">
									{timeLabel}
								</div>

								{/* Day cells */}
								{DAYS_OF_WEEK.map((day) => {
									const key = `${day.value}-${blockStart}`;
									const blockData = blocks.get(key);

									if (!blockData) {
										return (
											<div
												key={day.value}
												className="border border-dashed border-muted rounded-md p-2 min-h-[60px]"
											/>
										);
									}

									const hasAvailable = blockData.available > 0;

									return (
										<Button
											key={day.value}
											variant={
												blockData.hasUserRegistered ? "default" : "outline"
											}
											className={cn(
												"h-auto min-h-[60px] flex flex-col items-center justify-center gap-1 p-2",
												!blockData.hasUserRegistered &&
													hasAvailable &&
													"border-green-500 hover:border-green-600",
												!blockData.hasUserRegistered &&
													!hasAvailable &&
													"opacity-50",
											)}
											onClick={() =>
												onBlockClick(
													day.value,
													formatTimeFromMinutes(blockStart),
												)
											}
										>
											<div
												className={cn(
													"text-lg font-bold",
													blockData.hasUserRegistered
														? "text-primary-foreground"
														: hasAvailable
															? "text-green-600 dark:text-green-400"
															: "text-muted-foreground",
												)}
											>
												{blockData.available}
											</div>
											<div
												className={cn(
													"text-xs",
													blockData.hasUserRegistered &&
														"text-primary-foreground/80",
												)}
											>
												Available
											</div>
											{blockData.hasUserRegistered && (
												<div className="text-xs font-medium">✓ Registered</div>
											)}
										</Button>
									);
								})}
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
}
