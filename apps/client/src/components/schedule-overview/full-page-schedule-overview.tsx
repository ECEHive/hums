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
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Spinner } from "@/components/ui/spinner";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { OverviewHeatmapGrid } from "./overview-heatmap-grid";
import { OverviewMobileSheet } from "./overview-mobile-sheet";
import { OverviewSidebar, OverviewSidebarEmpty } from "./overview-sidebar";
import {
	calculateBlockSize,
	DAYS_OF_WEEK,
	groupSchedulesByDayAndTimeBlock,
	type OverviewSchedule,
} from "./overview-utils";

interface FullPageScheduleOverviewProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	schedules: OverviewSchedule[];
	isLoading: boolean;
	periodName: string;
}

// Legend Component
function OverviewLegend() {
	return (
		<div className="flex flex-wrap items-center gap-4 text-xs">
			<div className="flex items-center gap-1.5">
				<div className="w-3 h-3 rounded bg-cyan-500" />
				<span>Full</span>
			</div>
			<div className="flex items-center gap-1.5">
				<div className="w-3 h-3 rounded bg-cyan-500/40" />
				<span>Partial</span>
			</div>
			<div className="flex items-center gap-1.5">
				<div className="w-3 h-3 rounded bg-muted" />
				<span>Empty</span>
			</div>
			<div className="flex items-center gap-1.5">
				<div className="w-3 h-3 rounded ring-2 ring-primary ring-offset-1" />
				<span>Current</span>
			</div>
		</div>
	);
}

export function FullPageScheduleOverview({
	open,
	onOpenChange,
	schedules,
	isLoading,
	periodName,
}: FullPageScheduleOverviewProps) {
	const [selectedBlock, setSelectedBlock] = useState<{
		dayOfWeek: number;
		timeBlock: number;
	} | null>(null);
	const [filterOpen, setFilterOpen] = useState(false);
	const [shiftTypeFilter, setShiftTypeFilter] = useState<Set<number>>(
		new Set(),
	);
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
			return true;
		});
	}, [schedules, shiftTypeFilter]);

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

	const hasActiveFilters = shiftTypeFilter.size > 0;

	const clearFilters = () => {
		setShiftTypeFilter(new Set());
	};

	// Summary stats
	const totalSlots = filteredSchedules.reduce((sum, s) => sum + s.slots, 0);
	const filledSlots = filteredSchedules.reduce(
		(sum, s) => sum + s.filledSlots,
		0,
	);
	const fillPercent =
		totalSlots > 0 ? Math.round((filledSlots / totalSlots) * 100) : 0;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogPortal>
				<DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
				<DialogPrimitive.Content
					data-slot="dialog-content"
					className="!fixed !inset-0 !max-w-none !w-screen !h-screen !p-0 !gap-0 !rounded-none !border-0 !translate-x-0 !translate-y-0 !top-0 !left-0 overflow-hidden z-50 bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right duration-300"
					onInteractOutside={(e) => e.preventDefault()}
					onPointerDownOutside={(e) => e.preventDefault()}
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
										<h1 className="text-lg font-semibold">Schedule Overview</h1>
										<p className="text-xs text-muted-foreground">
											{periodName} • {filledSlots}/{totalSlots} slots filled (
											{fillPercent}%)
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
														{shiftTypeFilter.size}
													</Badge>
												)}
											</Button>
										</DropdownMenuTrigger>
										<DropdownMenuContent
											align="end"
											className="w-56"
											onCloseAutoFocus={(e) => e.preventDefault()}
										>
											<DropdownMenuLabel>Filters</DropdownMenuLabel>
											<DropdownMenuSeparator />
											{shiftTypes.length > 0 && (
												<>
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
															onSelect={(e) => e.preventDefault()}
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
															onClick={() => {
																clearFilters();
																setFilterOpen(false);
															}}
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
						</header>

						{/* Main Content Area */}
						<div className="flex flex-1 min-h-0 overflow-hidden">
							{isMobile ? (
								<>
									{/* Mobile: No resizable panels */}
									<main
										className={cn(
											"flex-1 min-w-0 flex flex-col overflow-hidden",
											selectedBlock && "hidden",
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
													<OverviewLegend />
												</div>

												{/* Scrollable Grid */}
												<OverviewHeatmapGrid
													visibleDays={visibleDays}
													timeBlockStarts={timeBlockStarts}
													blockSize={blockSize}
													blocks={blocks}
													selectedBlock={selectedBlock}
													onSelectBlock={(dayOfWeek, timeBlock) =>
														setSelectedBlock({ dayOfWeek, timeBlock })
													}
												/>
											</>
										)}
									</main>

									{/* Mobile Sheet */}
									{selectedBlock && (
										<OverviewMobileSheet
											open={selectedBlock !== null}
											schedules={selectedBlockSchedules}
											dayOfWeek={selectedBlock.dayOfWeek}
											timeBlock={selectedBlock.timeBlock}
											onClose={() => setSelectedBlock(null)}
										/>
									)}
								</>
							) : (
								/* Desktop: Resizable panels */
								<ResizablePanelGroup
									orientation="horizontal"
									className="flex-1"
								>
									<ResizablePanel minSize={500}>
										<main className="flex h-full flex-col overflow-hidden">
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
														<OverviewLegend />
													</div>

													{/* Scrollable Grid */}
													<OverviewHeatmapGrid
														visibleDays={visibleDays}
														timeBlockStarts={timeBlockStarts}
														blockSize={blockSize}
														blocks={blocks}
														selectedBlock={selectedBlock}
														onSelectBlock={(dayOfWeek, timeBlock) =>
															setSelectedBlock({ dayOfWeek, timeBlock })
														}
													/>
												</>
											)}
										</main>
									</ResizablePanel>

									<ResizableHandle withHandle />

									<ResizablePanel
										defaultSize={400}
										minSize={100}
										maxSize={1000}
									>
										<aside className="h-full bg-card flex flex-col overflow-hidden">
											{selectedBlock ? (
												<OverviewSidebar
													schedules={selectedBlockSchedules}
													dayOfWeek={selectedBlock.dayOfWeek}
													timeBlock={selectedBlock.timeBlock}
												/>
											) : (
												<OverviewSidebarEmpty />
											)}
										</aside>
									</ResizablePanel>
								</ResizablePanelGroup>
							)}
						</div>
					</div>
				</DialogPrimitive.Content>
			</DialogPortal>
		</Dialog>
	);
}
