import { cn } from "@/lib/utils";
import type { TimeBlock } from "./shift-scheduler-utils";
import { type DAYS_OF_WEEK, formatCompactTime } from "./shift-scheduler-utils";

interface SchedulerGridProps {
	visibleDays: typeof DAYS_OF_WEEK;
	timeBlockStarts: number[];
	blocks: Map<string, TimeBlock>;
	selectedBlock: { dayOfWeek: number; timeBlock: number } | null;
	onSelectBlock: (dayOfWeek: number, timeBlock: number) => void;
}

export function SchedulerGrid({
	visibleDays,
	timeBlockStarts,
	blocks,
	selectedBlock,
	onSelectBlock,
}: SchedulerGridProps) {
	return (
		<div className="flex-1 overflow-auto relative">
			<div className="inline-block min-w-full">
				<table className="border-collapse">
					{/* Sticky Header Row */}
					<thead>
						<tr>
							{/* Corner cell - sticky both ways */}
							<th className="sticky left-0 top-0 z-30 bg-background p-2 min-w-[70px] border-b border-r">
								<span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
									Time
								</span>
							</th>
							{/* Day headers - sticky top */}
							{visibleDays.map((day) => (
								<th
									key={day.value}
									className="sticky top-0 z-20 bg-background p-2 min-w-[120px] border-b"
								>
									<div className="text-center py-1">
										<div className="hidden sm:block text-sm font-semibold">
											{day.label}
										</div>
										<div className="sm:hidden text-sm font-semibold">
											{day.short}
										</div>
									</div>
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{timeBlockStarts.map((blockStart) => (
							<tr key={blockStart}>
								{/* Time Label - sticky left */}
								<td className="sticky left-0 z-10 bg-background p-2 border-r">
									<div className="flex items-center justify-end pr-1 text-xs text-muted-foreground font-medium whitespace-nowrap">
										{formatCompactTime(blockStart)}
									</div>
								</td>
								{/* Day Cells */}
								{visibleDays.map((day) => {
									const key = `${day.value}-${blockStart}`;
									const blockData = blocks.get(key);

									if (!blockData) {
										return (
											<td key={key} className="p-1">
												<div className="h-14 rounded-lg border border-dashed border-muted/50 bg-muted/10" />
											</td>
										);
									}

									const hasAvailable = blockData.available > 0;
									const isRegistered = blockData.hasUserRegistered;
									const isSelected =
										selectedBlock?.dayOfWeek === day.value &&
										selectedBlock?.timeBlock === blockStart;

									// Check if all schedules are truly full (no available slots)
									const isTrulyFull = blockData.schedules.every(
										(s) => s.availableSlots === 0,
									);

									return (
										<td key={key} className="p-1">
											<button
												type="button"
												onClick={() => onSelectBlock(day.value, blockStart)}
												className={cn(
													"w-full h-12 rounded-lg border-2 transition-all flex items-center justify-center gap-2 px-2 hover:scale-[1.02] active:scale-[0.98]",
													isSelected && "ring-2 ring-offset-2 ring-primary",
													isRegistered
														? "border-primary bg-primary text-primary-foreground"
														: hasAvailable
															? "border-green-500/50 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 hover:border-green-500"
															: isTrulyFull
																? "border-muted bg-muted/40 text-muted-foreground"
																: "border-amber-500/40 bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400",
												)}
											>
												{isRegistered ? (
													<span className="text-lg font-bold">✓</span>
												) : isTrulyFull ? (
													<span className="text-xs">full</span>
												) : hasAvailable ? (
													<>
														<span className="text-lg font-bold tabular-nums">
															{blockData.available}
														</span>
														<span className="text-xs">open</span>
													</>
												) : (
													<>
														<span className="text-lg font-bold tabular-nums">
															{blockData.available}
														</span>
														<span className="text-xs">available</span>
													</>
												)}
											</button>
										</td>
									);
								})}
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}
