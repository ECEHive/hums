import * as DialogPrimitive from "@radix-ui/react-dialog";
import { CalendarDays, ChevronLeft, Filter } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogPortal } from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import {
	DesktopShiftSidebar,
	DesktopShiftSidebarEmpty,
} from "./desktop-shift-sidebar";
import { MobileShiftSheet } from "./mobile-shift-sheet";
import { SchedulerGrid } from "./scheduler-grid";
import {
	calculateBlockSize,
	DAYS_OF_WEEK,
	groupSchedulesByDayAndTimeBlock,
	REQUIREMENT_UNIT_LABELS,
	type RequirementProgress,
	type ShiftSchedule,
} from "./shift-scheduler-utils";

interface FullPageSchedulerProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	schedules: ShiftSchedule[];
	isLoading: boolean;
	periodId: number;
	isWithinSignupWindow: boolean;
	requirementProgress: RequirementProgress | null;
}

// Legend Component
function SchedulerLegend() {
	return (
		<div className="flex flex-wrap items-center gap-4 text-xs">
			<div className="flex items-center gap-1.5">
				<div className="w-3 h-3 rounded bg-primary" />
				<span>Registered</span>
			</div>
			<div className="flex items-center gap-1.5">
				<div className="w-3 h-3 rounded bg-green-500/60" />
				<span>Available</span>
			</div>
			<div className="flex items-center gap-1.5">
				<div className="w-3 h-3 rounded bg-amber-500/60" />
				<span>Unavailable</span>
			</div>
			<div className="flex items-center gap-1.5">
				<div className="w-3 h-3 rounded bg-muted" />
				<span>Full</span>
			</div>
		</div>
	);
}

export function FullPageScheduler({
	open,
	onOpenChange,
	schedules,
	isLoading,
	periodId,
	isWithinSignupWindow,
	requirementProgress,
}: FullPageSchedulerProps) {
	const [selectedBlock, setSelectedBlock] = useState<{
		dayOfWeek: number;
		timeBlock: number;
	} | null>(null);
	const [filterOpen, setFilterOpen] = useState(false);
	const [shiftTypeFilter, setShiftTypeFilter] = useState<Set<number>>(
		new Set(),
	);
	const [showOnlyAvailable, setShowOnlyAvailable] = useState(false);
	const [showOnlyRegistered, setShowOnlyRegistered] = useState(false);
	const isMobile = useIsMobile();

	// Get unique shift types for filter
	const shiftTypes = useMemo(() => {
		const types = new Map<number, { name: string; color: string | null }>();
		for (const schedule of schedules) {
			if (!types.has(schedule.shiftTypeId)) {
				types.set(schedule.shiftTypeId, {
					name: schedule.shiftTypeName,
					color: schedule.shiftTypeColor,
				});
			}
		}
		return Array.from(types.entries()).map(([id, data]) => ({
			id,
			...data,
		}));
	}, [schedules]);

	// Filter schedules
	const filteredSchedules = useMemo(() => {
		return schedules.filter((s) => {
			if (shiftTypeFilter.size > 0 && !shiftTypeFilter.has(s.shiftTypeId)) {
				return false;
			}
			if (showOnlyAvailable && !s.canRegister) return false;
			if (showOnlyRegistered && !s.isRegistered) return false;
			return true;
		});
	}, [schedules, shiftTypeFilter, showOnlyAvailable, showOnlyRegistered]);

	const blockSize = useMemo(
		() => calculateBlockSize(filteredSchedules),
		[filteredSchedules],
	);
	const blocks = useMemo(
		() => groupSchedulesByDayAndTimeBlock(filteredSchedules, blockSize),
		[filteredSchedules, blockSize],
	);

	// Determine visible days
	const visibleDays = useMemo(() => {
		const daysWithSchedules = new Set(
			filteredSchedules.map((s) => s.dayOfWeek),
		);
		return DAYS_OF_WEEK.filter((day) => daysWithSchedules.has(day.value));
	}, [filteredSchedules]);

	// Get time blocks
	const timeBlockStarts = useMemo(() => {
		const allTimeBlocks = new Set<number>();
		for (const key of blocks.keys()) {
			const [, timeStr] = key.split("-");
			allTimeBlocks.add(Number.parseInt(timeStr, 10));
		}
		return Array.from(allTimeBlocks).sort((a, b) => a - b);
	}, [blocks]);

	// Get schedules for selected block
	const selectedBlockSchedules = useMemo(() => {
		if (!selectedBlock) return [];
		const key = `${selectedBlock.dayOfWeek}-${selectedBlock.timeBlock}`;
		return blocks.get(key)?.schedules ?? [];
	}, [selectedBlock, blocks]);

	// Requirement progress display
	const requirementUnit = requirementProgress?.unit ?? null;
	const requirementUnitLabel = requirementUnit
		? REQUIREMENT_UNIT_LABELS[requirementUnit]
		: null;
	const progressPercent = requirementProgress
		? Math.min(
				100,
				Math.max(
					0,
					requirementProgress.minPercent ?? requirementProgress.maxPercent ?? 0,
				),
			)
		: 0;

	const hasActiveFilters =
		shiftTypeFilter.size > 0 || showOnlyAvailable || showOnlyRegistered;

	const clearFilters = () => {
		setShiftTypeFilter(new Set());
		setShowOnlyAvailable(false);
		setShowOnlyRegistered(false);
	};

	const registeredCount = schedules.filter((s) => s.isRegistered).length;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogPortal>
				<DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
				<DialogPrimitive.Content
					data-slot="dialog-content"
					className="!fixed !inset-0 !max-w-none !w-screen !h-screen !p-0 !gap-0 !rounded-none !border-0 !translate-x-0 !translate-y-0 !top-0 !left-0 overflow-hidden z-50 bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right duration-300"
				>
					<div className="flex flex-col h-screen w-screen bg-background">
						{/* Fixed Header */}
						<header className="shrink-0 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 z-10">
							<div className="flex items-center justify-between px-4 py-3">
								<div className="flex items-center gap-3">
									<Button
										variant="ghost"
										size="icon"
										onClick={() => onOpenChange(false)}
										className="shrink-0"
									>
										<ChevronLeft className="h-5 w-5" />
									</Button>
									<div>
										<h1 className="text-lg font-semibold">Shift Scheduler</h1>
										<p className="text-xs text-muted-foreground">
											{registeredCount} shift
											{registeredCount !== 1 ? "s" : ""} registered
										</p>
									</div>
								</div>

								<div className="flex items-center gap-2">
									{/* Filter button */}
									<DropdownMenu open={filterOpen} onOpenChange={setFilterOpen}>
										<DropdownMenuTrigger asChild>
											<Button
												variant={hasActiveFilters ? "secondary" : "outline"}
												size="sm"
												className="gap-1.5"
											>
												<Filter className="h-4 w-4" />
												<span className="hidden sm:inline">Filter</span>
												{hasActiveFilters && (
													<Badge
														variant="secondary"
														className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-[10px]"
													>
														{shiftTypeFilter.size +
															(showOnlyAvailable ? 1 : 0) +
															(showOnlyRegistered ? 1 : 0)}
													</Badge>
												)}
											</Button>
										</DropdownMenuTrigger>
										<DropdownMenuContent align="end" className="w-56">
											<DropdownMenuLabel>Filters</DropdownMenuLabel>
											<DropdownMenuSeparator />
											<DropdownMenuCheckboxItem
												checked={showOnlyAvailable}
												onCheckedChange={setShowOnlyAvailable}
											>
												Available only
											</DropdownMenuCheckboxItem>
											<DropdownMenuCheckboxItem
												checked={showOnlyRegistered}
												onCheckedChange={setShowOnlyRegistered}
											>
												My registrations
											</DropdownMenuCheckboxItem>
											{shiftTypes.length > 0 && (
												<>
													<DropdownMenuSeparator />
													<DropdownMenuLabel className="text-xs text-muted-foreground">
														Shift Types
													</DropdownMenuLabel>
													{shiftTypes.map((type) => (
														<DropdownMenuCheckboxItem
															key={type.id}
															checked={shiftTypeFilter.has(type.id)}
															onCheckedChange={(checked) => {
																const newFilter = new Set(shiftTypeFilter);
																if (checked) {
																	newFilter.add(type.id);
																} else {
																	newFilter.delete(type.id);
																}
																setShiftTypeFilter(newFilter);
															}}
														>
															<div className="flex items-center gap-2">
																{type.color && (
																	<div
																		className="w-2.5 h-2.5 rounded-full"
																		style={{ backgroundColor: type.color }}
																	/>
																)}
																{type.name}
															</div>
														</DropdownMenuCheckboxItem>
													))}
												</>
											)}
											{hasActiveFilters && (
												<>
													<DropdownMenuSeparator />
													<div className="p-2">
														<Button
															variant="outline"
															size="sm"
															className="w-full"
															onClick={clearFilters}
														>
															Clear filters
														</Button>
													</div>
												</>
											)}
										</DropdownMenuContent>
									</DropdownMenu>
								</div>
							</div>

							{/* Progress bar */}
							{requirementProgress && requirementUnitLabel && (
								<div className="px-4 pb-3">
									<div className="flex items-center justify-between text-xs mb-1.5">
										<span className="text-muted-foreground">Progress</span>
										<span className="font-medium">
											{requirementProgress.current}
											{requirementProgress.min != null
												? ` / ${requirementProgress.min}`
												: requirementProgress.max != null
													? ` / ${requirementProgress.max}`
													: ""}{" "}
											{requirementUnitLabel}
										</span>
									</div>
									<Progress value={progressPercent} className="h-2" />
								</div>
							)}
						</header>

						{/* Main Content Area */}
						<div className="flex flex-1 min-h-0 overflow-hidden">
							{/* Schedule Grid */}
							<main
								className={cn(
									"flex-1 min-w-0 flex flex-col overflow-hidden",
									selectedBlock && "hidden md:flex",
								)}
							>
								{isLoading ? (
									<div className="flex-1 flex items-center justify-center">
										<Spinner className="w-8 h-8" />
									</div>
								) : filteredSchedules.length === 0 ? (
									<div className="flex-1 flex flex-col items-center justify-center text-center p-8">
										<CalendarDays className="w-12 h-12 text-muted-foreground/50 mb-4" />
										<h3 className="text-lg font-medium mb-1">
											No shifts found
										</h3>
										<p className="text-sm text-muted-foreground mb-4">
											{hasActiveFilters
												? "Try adjusting your filters"
												: "No shifts available for this period"}
										</p>
										{hasActiveFilters && (
											<Button
												variant="outline"
												size="sm"
												onClick={clearFilters}
											>
												Clear filters
											</Button>
										)}
									</div>
								) : (
									<>
										{/* Legend */}
										<div className="shrink-0 px-4 py-2 border-b bg-muted/30">
											<SchedulerLegend />
										</div>

										{/* Scrollable Grid */}
										<SchedulerGrid
											visibleDays={visibleDays}
											timeBlockStarts={timeBlockStarts}
											blocks={blocks}
											selectedBlock={selectedBlock}
											onSelectBlock={(dayOfWeek, timeBlock) =>
												setSelectedBlock({ dayOfWeek, timeBlock })
											}
										/>
									</>
								)}
							</main>

							{/* Desktop Sidebar */}
							{!isMobile && (
								<aside className="hidden w-96 shrink-0 border-l bg-card md:flex md:flex-col">
									{selectedBlock ? (
										<DesktopShiftSidebar
											schedules={selectedBlockSchedules}
											dayOfWeek={selectedBlock.dayOfWeek}
											timeBlock={selectedBlock.timeBlock}
											periodId={periodId}
											isWithinSignupWindow={isWithinSignupWindow}
										/>
									) : (
										<DesktopShiftSidebarEmpty />
									)}
								</aside>
							)}

							{/* Mobile Sheet */}
							{isMobile && selectedBlock && (
								<MobileShiftSheet
									open={selectedBlock !== null}
									schedules={selectedBlockSchedules}
									dayOfWeek={selectedBlock.dayOfWeek}
									timeBlock={selectedBlock.timeBlock}
									periodId={periodId}
									isWithinSignupWindow={isWithinSignupWindow}
									onClose={() => setSelectedBlock(null)}
								/>
							)}
						</div>
					</div>
				</DialogPrimitive.Content>
			</DialogPortal>
		</Dialog>
	);
}
