import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
	type DAYS_OF_WEEK,
	formatCompactTime,
	getCurrentDayOfWeek,
	getCurrentTimeMinutes,
	type OverviewTimeBlock,
} from "./overview-utils";

interface OverviewHeatmapGridProps {
	visibleDays: typeof DAYS_OF_WEEK;
	timeBlockStarts: number[];
	blockSize: number;
	blocks: Map<string, OverviewTimeBlock>;
	selectedBlock: { dayOfWeek: number; timeBlock: number } | null;
	onSelectBlock: (dayOfWeek: number, timeBlock: number) => void;
}

/**
 * Hook to detect dark mode by observing the document's class list.
 */
function useIsDarkMode(): boolean {
	const [isDark, setIsDark] = useState(() => {
		if (typeof window === "undefined") return false;
		return document.documentElement.classList.contains("dark");
	});

	useEffect(() => {
		const observer = new MutationObserver(() => {
			setIsDark(document.documentElement.classList.contains("dark"));
		});

		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["class"],
		});

		return () => observer.disconnect();
	}, []);

	return isDark;
}

/**
 * Hook to update current time indicator every minute.
 */
function useCurrentTime(): { dayOfWeek: number; timeMinutes: number } {
	const [time, setTime] = useState(() => ({
		dayOfWeek: getCurrentDayOfWeek(),
		timeMinutes: getCurrentTimeMinutes(),
	}));

	useEffect(() => {
		const update = () => {
			setTime({
				dayOfWeek: getCurrentDayOfWeek(),
				timeMinutes: getCurrentTimeMinutes(),
			});
		};

		// Update every minute
		const interval = setInterval(update, 60000);

		return () => clearInterval(interval);
	}, []);

	return time;
}

/**
 * Calculate heatmap color based on fill ratio.
 * Higher fill = warmer color (more saturated).
 */
function getHeatmapStyles(
	filled: number,
	total: number,
	isDarkMode: boolean,
): {
	className: string;
	style: React.CSSProperties;
	ariaLabel: string;
} {
	if (total === 0) {
		return {
			className: "border-muted bg-muted/20 text-muted-foreground",
			style: {},
			ariaLabel: "No slots",
		};
	}

	const ratio = filled / total;
	const clampedRatio = Math.max(0, Math.min(1, ratio));

	// Empty slots - gray
	if (filled === 0) {
		return {
			className: "border-muted bg-muted/40 text-muted-foreground",
			style: {},
			ariaLabel: `0 of ${total} slots filled`,
		};
	}

	// Full slots - use a teal/cyan color
	if (filled === total) {
		return {
			className: isDarkMode
				? "border-cyan-500/60 bg-cyan-950/40 text-cyan-400"
				: "border-cyan-500/50 bg-cyan-50 text-cyan-700",
			style: {},
			ariaLabel: `${filled} of ${total} slots filled (100%)`,
		};
	}

	// Partial fill - gradient from gray to teal based on ratio
	// Using HSL with hue 180 (cyan/teal)
	const hue = 180;
	const saturation = isDarkMode
		? Math.round(40 + clampedRatio * 30) // 40% to 70%
		: Math.round(50 + clampedRatio * 30); // 50% to 80%

	const bgLightness = isDarkMode
		? Math.round(15 + clampedRatio * 10) // 15% to 25%
		: Math.round(95 - clampedRatio * 10); // 95% to 85%

	const borderLightness = isDarkMode
		? Math.round(35 + clampedRatio * 15) // 35% to 50%
		: Math.round(55 - clampedRatio * 15); // 55% to 40%

	const textLightness = isDarkMode
		? Math.round(55 + clampedRatio * 20) // 55% to 75%
		: Math.round(40 - clampedRatio * 10); // 40% to 30%

	const borderOpacity = 0.4 + clampedRatio * 0.3;
	const bgOpacity = isDarkMode ? 0.3 + clampedRatio * 0.2 : 1;

	return {
		className: "hover:scale-[1.02]",
		style: {
			borderColor: `hsla(${hue}, ${saturation}%, ${borderLightness}%, ${borderOpacity})`,
			backgroundColor: isDarkMode
				? `hsla(${hue}, ${saturation}%, ${bgLightness}%, ${bgOpacity})`
				: `hsl(${hue}, ${saturation}%, ${bgLightness}%)`,
			color: `hsl(${hue}, ${Math.round(saturation * 0.85)}%, ${textLightness}%)`,
		},
		ariaLabel: `${filled} of ${total} slots filled (${Math.round(clampedRatio * 100)}%)`,
	};
}

export function OverviewHeatmapGrid({
	visibleDays,
	timeBlockStarts,
	blockSize,
	blocks,
	selectedBlock,
	onSelectBlock,
}: OverviewHeatmapGridProps) {
	const isDarkMode = useIsDarkMode();
	const currentTime = useCurrentTime();

	// Calculate minimum table width
	const minTableWidth = 80 + visibleDays.length * 120;

	return (
		<div className="flex-1 overflow-auto relative">
			<div className="pb-24" style={{ minWidth: minTableWidth }}>
				<table className="w-full border-collapse table-fixed">
					<thead>
						<tr>
							<th
								className="sticky left-0 top-0 z-30 bg-background p-2 border-b border-r"
								style={{ width: 80 }}
							>
								<span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
									Time
								</span>
							</th>
							{visibleDays.map((day) => (
								<th
									key={day.value}
									className={cn(
										"sticky top-0 z-20 bg-background p-2 border-b",
										day.value === currentTime.dayOfWeek && "bg-primary/5",
									)}
								>
									<div className="text-center py-1">
										<div className="hidden sm:block text-sm font-semibold">
											{day.label}
											{day.value === currentTime.dayOfWeek && (
												<span className="ml-1 text-xs font-normal text-primary">
													(Today)
												</span>
											)}
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
						{timeBlockStarts.map((blockStart) => {
							const isCurrentTimeRow =
								currentTime.dayOfWeek >= 0 &&
								currentTime.timeMinutes >= blockStart &&
								currentTime.timeMinutes < blockStart + blockSize;

							return (
								<tr key={blockStart}>
									<td
										className={cn(
											"sticky left-0 z-10 bg-background p-2 border-r",
											isCurrentTimeRow && "bg-primary/5",
										)}
									>
										<div className="flex items-center justify-end pr-1 text-xs text-muted-foreground font-medium whitespace-nowrap">
											{formatCompactTime(blockStart)}
										</div>
									</td>
									{visibleDays.map((day) => {
										const key = `${day.value}-${blockStart}`;
										const blockData = blocks.get(key);

										const isCurrentCell =
											day.value === currentTime.dayOfWeek &&
											currentTime.timeMinutes >= blockStart &&
											currentTime.timeMinutes < blockStart + blockSize;

										const isSelected =
											selectedBlock?.dayOfWeek === day.value &&
											selectedBlock?.timeBlock === blockStart;

										if (!blockData) {
											return (
												<td key={key} className="p-1">
													<div
														className={cn(
															"h-14 rounded-lg border border-dashed border-muted/50 bg-muted/10",
															isCurrentCell &&
																"ring-2 ring-primary ring-offset-1",
														)}
													/>
												</td>
											);
										}

										const heatmapStyles = getHeatmapStyles(
											blockData.filled,
											blockData.total,
											isDarkMode,
										);

										return (
											<td key={key} className="p-1">
												<button
													type="button"
													onClick={() => onSelectBlock(day.value, blockStart)}
													aria-label={heatmapStyles.ariaLabel}
													aria-pressed={isSelected}
													className={cn(
														"w-full h-12 rounded-lg border-2 transition-all flex items-center justify-center gap-1.5 px-2 active:scale-[0.98]",
														isSelected && "ring-2 ring-offset-2 ring-primary",
														isCurrentCell &&
															!isSelected &&
															"ring-2 ring-primary ring-offset-1",
														heatmapStyles.className,
													)}
													style={heatmapStyles.style}
												>
													<span className="text-base font-bold tabular-nums">
														{blockData.filled}
													</span>
													<span className="text-[10px] opacity-80">
														/{blockData.total}
													</span>
												</button>
											</td>
										);
									})}
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
		</div>
	);
}
