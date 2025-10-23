import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { ClockIcon } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

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
	offsetIndex: number;
	totalOverlaps: number;
}

function parseTimeToMinutes(time: string): number {
	const [hours, minutes] = time.split(":").map(Number);
	return hours * 60 + minutes;
}

// Sort schedules by shift type name alphabetically
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
	}>; // Filter out any missing shift types

	return withTypes.sort((a, b) =>
		a.shiftType.name.localeCompare(b.shiftType.name),
	);
}

// Calculate overlaps and assign offset positions
function calculateTimelineLayout(
	schedules: ShiftSchedule[],
	shiftTypesMap: Map<number, ShiftTypeInfo>,
): TimelineItem[] {
	const sorted = sortSchedulesWithTypes(schedules, shiftTypesMap);
	const items: TimelineItem[] = [];

	for (const { schedule, shiftType } of sorted) {
		const startMinutes = parseTimeToMinutes(schedule.startTime);
		const endMinutes = parseTimeToMinutes(schedule.endTime);

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
				limit: 100,
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

	const timelineItems = calculateTimelineLayout(schedules, shiftTypesMap);

	// Find earliest and latest times for the timeline
	const minTime =
		timelineItems.length > 0
			? Math.min(...timelineItems.map((item) => item.startMinutes))
			: 0;
	const maxTime =
		timelineItems.length > 0
			? Math.max(...timelineItems.map((item) => item.endMinutes))
			: 24 * 60;

	const timelineHeight = maxTime - minTime;

	// Calculate height
	const thirtyMinuteBlocks = Math.ceil(timelineHeight / 30);
	const heightPerBlock = 80; // Pixels per block
	const calculatedHeight = thirtyMinuteBlocks * heightPerBlock;
	const containerHeight = calculatedHeight;

	return (
		<Tabs
			value={String(selectedDay)}
			onValueChange={(value) => setSelectedDay(Number.parseInt(value, 10))}
			className="w-full"
		>
			<TabsList className="grid w-full grid-cols-7">
				{DAYS_OF_WEEK.map((day) => (
					<TabsTrigger key={day.value} value={String(day.value)}>
						<span className="hidden sm:inline">{day.label}</span>
						<span className="sm:hidden">{day.short}</span>
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
						<Card>
							<CardContent className="p-6 max-h-[600px] overflow-auto">
								{/* Scrollable container with max height */}
								<div className="p-2 overflow-visible">
									<div
										className="relative"
										style={{
											height: `${containerHeight}px`,
											minWidth: "100%",
											paddingTop: "12px",
											paddingBottom: "12px",
										}}
									>
										{/* Time markers on the left */}
										<div className="absolute left-0 top-0 bottom-0 w-20 pointer-events-none z-10 pt-3 pb-3">
											{Array.from(
												{
													// Generate 30-minute increments
													length: Math.floor((maxTime - minTime) / 30) + 1,
												},
												(_, i) => {
													const minutes = minTime + i * 30;
													const hours = Math.floor(minutes / 60);
													const mins = minutes % 60;
													const totalHeight = containerHeight - 24; // Account for padding
													const top =
														((minutes - minTime) / timelineHeight) *
														totalHeight;

													return (
														<div
															key={`time-marker-${minutes}`}
															className="absolute left-0 right-0"
															style={{ top: `${top}px` }}
														>
															<span className="absolute -top-2 left-0 text-xs font-medium text-muted-foreground pr-2">
																{hours.toString().padStart(2, "0")}:
																{mins.toString().padStart(2, "0")}
															</span>
														</div>
													);
												},
											)}
										</div>

										{/* Timeline grid lines */}
										<div className="absolute inset-0 pl-20 pointer-events-none pt-3 pb-3">
											{Array.from(
												{
													length: Math.floor((maxTime - minTime) / 30) + 1,
												},
												(_, i) => {
													const minutes = minTime + i * 30;
													const totalHeight = containerHeight - 24; // Account for padding
													const top =
														((minutes - minTime) / timelineHeight) *
														totalHeight;
													const isHour = minutes % 60 === 0;

													return (
														<div
															key={`grid-line-${minutes}`}
															className={cn(
																"absolute left-0 right-0 border-t",
																isHour ? "border-border" : "border-border/30",
															)}
															style={{ top: `${top}px` }}
														/>
													);
												},
											)}
										</div>

										{/* Shift schedule blocks */}
										<div className="absolute top-0 bottom-0 left-20 right-0 pt-3 pb-3">
											{timelineItems.map((item) => {
												const totalHeight = containerHeight - 24; // Account for padding
												const top =
													((item.startMinutes - minTime) / timelineHeight) *
													totalHeight;
												const height =
													((item.endMinutes - item.startMinutes) /
														timelineHeight) *
													totalHeight;
												const width = 100 / item.totalOverlaps;
												const left =
													(item.offsetIndex * 100) / item.totalOverlaps;

												return (
													<button
														key={item.schedule.id}
														type="button"
														onClick={() => onScheduleClick?.(item.schedule.id)}
														className={cn(
															"absolute rounded-lg border-2 p-2 overflow-hidden transition-all hover:z-10 hover:shadow-lg",
															"bg-card hover:bg-accent/50",
															"cursor-pointer text-left",
														)}
														style={{
															top: `${top}px`,
															height: `${height}px`,
															left: `${left}%`,
															width: `${width}%`,
															borderColor: item.shiftType.color ?? "#888",
															minHeight: "48px",
														}}
													>
														<div className="flex flex-col h-full justify-between">
															<div className="font-semibold text-sm line-clamp-2 mb-1">
																{item.shiftType.name}
															</div>
															<Badge
																variant="secondary"
																className="w-fit text-xs"
															>
																{item.schedule.slots}{" "}
																{item.schedule.slots === 1 ? "slot" : "slots"}
															</Badge>
														</div>
													</button>
												);
											})}
										</div>
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
