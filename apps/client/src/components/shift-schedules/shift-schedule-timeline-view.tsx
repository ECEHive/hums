import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { ClockIcon } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const BLOCK_HEIGHT_REM = 4;
const MIN_BLOCK_WIDTH_REM = 8; // Minimum width per shift schedule block
const BLOCK_GAP_REM = 0.125; // Visual spacing between shift schedule blocks (2px at default font size)

const DAYS_OF_WEEK = [
	{ value: 0, label: "Sunday", short: "Sun" },
	{ value: 1, label: "Monday", short: "Mon" },
	{ value: 2, label: "Tuesday", short: "Tue" },
	{ value: 3, label: "Wednesday", short: "Wed" },
	{ value: 4, label: "Thursday", short: "Thu" },
	{ value: 5, label: "Friday", short: "Fri" },
	{ value: 6, label: "Saturday", short: "Sat" },
];

interface ShiftScheduleTimelineViewProps {
	periodId: number;
	onScheduleClick?: (scheduleId: number) => void;
}

interface ShiftSchedule {
	id: number;
	shiftTypeId: number;
	slots: number;
	dayOfWeek: number;
	startTime: string;
	endTime: string;
	assignedUserCount: number;
}

interface ShiftTypeInfo {
	id: number;
	name: string;
	color: string | null;
}

interface TimelineItem {
	schedule: ShiftSchedule;
	shiftType: ShiftTypeInfo;
	startMinutes: number;
	endMinutes: number;
	durationBlocks: number;
	offsetIndex: number;
	totalOverlaps: number;
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
 * Calculate the optimal block size based on shift durations
 * Returns the GCD of all durations, ensuring it's a reasonable interval
 */
function calculateBlockSize(schedules: ShiftSchedule[]): number {
	if (schedules.length === 0) return 30; // Default to 30 minutes

	const durations = schedules.map((schedule) => {
		const start = parseTimeToMinutes(schedule.startTime);
		const end = parseTimeToMinutes(schedule.endTime);
		return end - start;
	});

	// Find GCD of all durations
	let blockSize = durations[0];
	for (let i = 1; i < durations.length; i++) {
		blockSize = gcd(blockSize, durations[i]);
	}

	// Ensure block size is at least 5 minutes and at most 60 minutes
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
 * Round minutes down to nearest block
 */
function roundToBlock(minutes: number, blockSize: number): number {
	return Math.floor(minutes / blockSize) * blockSize;
}

/**
 * Calculate number of blocks for a duration
 */
function calculateBlocks(
	startMinutes: number,
	endMinutes: number,
	blockSize: number,
): number {
	return Math.ceil((endMinutes - startMinutes) / blockSize);
}

/**
 * Format minutes to HH:MM time string
 */
function formatTime(minutes: number): string {
	const hours = Math.floor(minutes / 60);
	const mins = minutes % 60;
	return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
}

/**
 * Sort schedules by shift type name alphabetically
 */
function sortSchedulesWithTypes(
	schedules: ShiftSchedule[],
	shiftTypesMap: Map<number, ShiftTypeInfo>,
): Array<{ schedule: ShiftSchedule; shiftType: ShiftTypeInfo }> {
	const withTypes = schedules
		.map((schedule) => ({
			schedule,
			shiftType: shiftTypesMap.get(schedule.shiftTypeId),
		}))
		.filter((item) => item.shiftType !== undefined) as Array<{
		schedule: ShiftSchedule;
		shiftType: ShiftTypeInfo;
	}>;

	return withTypes.sort((a, b) =>
		a.shiftType.name.localeCompare(b.shiftType.name),
	);
}

/**
 * Calculate overlaps and assign offset positions for timeline items
 * Each item is positioned to avoid overlapping with others
 */
function calculateTimelineLayout(
	schedules: ShiftSchedule[],
	shiftTypesMap: Map<number, ShiftTypeInfo>,
	blockSize: number,
): TimelineItem[] {
	const sorted = sortSchedulesWithTypes(schedules, shiftTypesMap);
	const items: TimelineItem[] = [];

	for (const { schedule, shiftType } of sorted) {
		const startMinutes = parseTimeToMinutes(schedule.startTime);
		const endMinutes = parseTimeToMinutes(schedule.endTime);
		const durationBlocks = calculateBlocks(startMinutes, endMinutes, blockSize);

		// Find overlapping items (start time inclusive, end time exclusive)
		const overlapping = items.filter((item) => {
			return startMinutes < item.endMinutes && endMinutes > item.startMinutes;
		});

		// Find the first available offset index
		const usedOffsets = new Set(overlapping.map((item) => item.offsetIndex));
		let offsetIndex = 0;
		while (usedOffsets.has(offsetIndex)) {
			offsetIndex++;
		}

		// Calculate total overlaps (including this item)
		const totalOverlaps = Math.max(
			offsetIndex + 1,
			...overlapping.map((item) => item.totalOverlaps),
		);

		// Update total overlaps for overlapping items
		for (const item of overlapping) {
			item.totalOverlaps = totalOverlaps;
		}

		items.push({
			schedule,
			shiftType,
			startMinutes,
			endMinutes,
			durationBlocks,
			offsetIndex,
			totalOverlaps,
		});
	}

	return items;
}

export function ShiftScheduleTimelineView({
	periodId,
	onScheduleClick,
}: ShiftScheduleTimelineViewProps) {
	const [selectedDay, setSelectedDay] = useState<number>(1); // Default to Monday

	const { data: schedulesData, isLoading: schedulesLoading } = useQuery({
		queryKey: ["shiftSchedules", { periodId, dayOfWeek: selectedDay }],
		queryFn: async () => {
			return trpc.shiftSchedules.list.query({
				periodId,
				dayOfWeek: selectedDay,
				limit: 1000,
			});
		},
	});

	const { data: shiftTypesData, isLoading: shiftTypesLoading } = useQuery({
		queryKey: ["shiftTypes", { periodId }],
		queryFn: async () => {
			return trpc.shiftTypes.list.query({
				periodId,
				limit: 100,
			});
		},
	});

	const isLoading = schedulesLoading || shiftTypesLoading;

	const schedules = (schedulesData?.shiftSchedules ?? []) as ShiftSchedule[];
	const shiftTypes = shiftTypesData?.shiftTypes ?? [];

	// Create a map of shift types for quick lookup
	const shiftTypesMap = new Map<number, ShiftTypeInfo>(
		shiftTypes.map((st) => [
			st.id,
			{ id: st.id, name: st.name, color: st.color },
		]),
	);

	// Calculate optimal block size based on shift durations
	const blockSize = calculateBlockSize(schedules);

	const timelineItems = calculateTimelineLayout(
		schedules,
		shiftTypesMap,
		blockSize,
	);

	// Calculate timeline bounds - round to nearest blocks
	const minTime =
		timelineItems.length > 0
			? roundToBlock(
					Math.min(...timelineItems.map((item) => item.startMinutes)),
					blockSize,
				)
			: 0;
	const maxTime =
		timelineItems.length > 0
			? roundToBlock(
					Math.max(...timelineItems.map((item) => item.endMinutes)),
					blockSize,
				) + blockSize
			: 24 * 60;

	const totalBlocks = (maxTime - minTime) / blockSize;

	return (
		<Tabs
			value={String(selectedDay)}
			onValueChange={(value) => setSelectedDay(Number.parseInt(value, 10))}
			className="w-full"
		>
			<TabsList className="grid w-full grid-cols-7">
				{DAYS_OF_WEEK.map((day) => (
					<TabsTrigger key={day.value} value={String(day.value)}>
						<span className="hidden lg:inline">{day.label}</span>
						<span className="lg:hidden">{day.short}</span>
					</TabsTrigger>
				))}
			</TabsList>

			{DAYS_OF_WEEK.map((day) => (
				<TabsContent key={day.value} value={String(day.value)}>
					{isLoading ? (
						<div className="flex items-center justify-center py-12">
							<Spinner className="size-8" />
						</div>
					) : timelineItems.length === 0 ? (
						<Card>
							<CardContent className="flex flex-col items-center justify-center py-12 text-center">
								<ClockIcon className="size-12 text-muted-foreground mb-4" />
								<h3 className="text-lg font-semibold mb-2">
									No Shift Schedules
								</h3>
								<p className="text-sm text-muted-foreground">
									There are no shift schedules for {day.label}
								</p>
							</CardContent>
						</Card>
					) : (
						<Card className="overflow-hidden">
							<CardContent className="p-0">
								<div className="overflow-auto max-h-[600px]">
									{/* Timeline container with fixed block heights and padding to prevent clipping */}
									<div
										className="relative min-w-full py-4 px-4 md:px-6"
										style={{
											height: `${totalBlocks * BLOCK_HEIGHT_REM + 2}rem`,
										}}
									>
										{/* Time markers - responsive width */}
										<div className="absolute left-4 md:left-6 top-4 bottom-4 w-12 sm:w-16 md:w-20 pointer-events-none z-10">
											{Array.from({ length: totalBlocks + 1 }, (_, i) => {
												const minutes = minTime + i * blockSize;
												const blockOffset = i;

												return (
													<div
														key={`time-${minutes}`}
														className="absolute left-0 right-0"
														style={{
															top: `${blockOffset * BLOCK_HEIGHT_REM}rem`,
														}}
													>
														<span className="absolute -translate-y-1/2 left-0 text-xs sm:text-sm font-medium text-muted-foreground pr-1 sm:pr-2">
															{formatTime(minutes)}
														</span>
													</div>
												);
											})}
										</div>

										{/* Timeline grid lines */}
										<div className="absolute top-4 bottom-4 left-0 right-0 pl-12 sm:pl-16 md:pl-20 ml-4 md:ml-6 pointer-events-none">
											{Array.from({ length: totalBlocks + 1 }, (_, i) => {
												const minutes = minTime + i * blockSize;
												const blockOffset = i;
												const isHour = minutes % 60 === 0;

												return (
													<div
														key={`grid-${minutes}`}
														className={cn(
															"absolute left-0 right-0 border-t",
															isHour ? "border-border" : "border-border/30",
														)}
														style={{
															top: `${blockOffset * BLOCK_HEIGHT_REM}rem`,
														}}
													/>
												);
											})}
										</div>

										{/* Shift schedule blocks */}
										{(() => {
											// Calculate the maximum overlaps to determine minimum container width
											const maxOverlaps = Math.max(
												1,
												...timelineItems.map((item) => item.totalOverlaps),
											);
											const minContainerWidthRem =
												maxOverlaps * MIN_BLOCK_WIDTH_REM;

											return (
												<div
													className="absolute top-4 bottom-4 left-12 sm:left-16 md:left-20 right-0 ml-4 md:ml-6"
													style={{ minWidth: `${minContainerWidthRem}rem` }}
												>
													{timelineItems.map((item) => {
														// Calculate position in blocks from timeline start
														const blocksFromStart =
															(item.startMinutes - minTime) / blockSize;
														const topRem = blocksFromStart * BLOCK_HEIGHT_REM;
														const heightRem =
															item.durationBlocks * BLOCK_HEIGHT_REM;

														// Calculate horizontal position for overlapping items
														const widthPercent = 100 / item.totalOverlaps;
														const leftPercent =
															(item.offsetIndex * 100) / item.totalOverlaps;

														// Use percentage-based positioning with minWidth
														// This allows blocks to expand when space is available
														// and triggers horizontal scroll when compressed below minWidth
														// Add small gaps for visual separation
														const positionStyle: React.CSSProperties = {
															top: `${topRem + BLOCK_GAP_REM}rem`,
															height: `calc(${heightRem}rem - ${BLOCK_GAP_REM * 2}rem)`,
															left: `calc(${leftPercent}% + ${BLOCK_GAP_REM}rem)`,
															width: `calc(${widthPercent}% - ${BLOCK_GAP_REM * 2}rem)`,
															minWidth: `${MIN_BLOCK_WIDTH_REM - BLOCK_GAP_REM * 2}rem`,
														};

														// Calculate actual duration in minutes
														const actualDurationMinutes =
															item.endMinutes - item.startMinutes;
														const isShortShift =
															actualDurationMinutes < blockSize;

														return (
															<button
																key={item.schedule.id}
																type="button"
																onClick={() =>
																	onScheduleClick?.(item.schedule.id)
																}
																className={cn(
																	"absolute rounded-lg border-2 transition-all hover:z-20 hover:shadow-lg",
																	"bg-card hover:bg-accent cursor-pointer text-left",
																	"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
																	"p-2",
																)}
																style={{
																	...positionStyle,
																	borderColor: item.shiftType.color ?? "#888",
																}}
																aria-label={`${item.shiftType.name} shift from ${item.schedule.startTime} to ${item.schedule.endTime}, ${item.schedule.slots} ${item.schedule.slots === 1 ? "slot" : "slots"}`}
															>
																{/* Duration indicator for short shifts */}
																{isShortShift && (
																	<div
																		className="absolute bottom-0 left-0 rounded-bl-md"
																		style={{
																			width: `${(actualDurationMinutes / blockSize) * 100}%`,
																			height: "3px",
																			backgroundColor:
																				item.shiftType.color ?? "#888",
																			opacity: 0.8,
																		}}
																		aria-hidden="true"
																	/>
																)}
																<div className="flex h-full flex-row items-center justify-between gap-1">
																	{/* Shift type name */}
																	<div className="font-semibold text-sm truncate flex-1">
																		{item.shiftType.name}
																	</div>

																	{/* Slot count badge */}
																	<Badge
																		variant="secondary"
																		className="shrink-0 h-4 px-1"
																	>
																		{item.schedule.slots}
																	</Badge>
																</div>
															</button>
														);
													})}
												</div>
											);
										})()}
									</div>
								</div>
							</CardContent>
						</Card>
					)}
				</TabsContent>
			))}
		</Tabs>
	);
}
