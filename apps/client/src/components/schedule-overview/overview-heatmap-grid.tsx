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
export function useIsDarkMode(): boolean {
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

// Ramp endpoints. Light mode darkens toward a saturated cyan as a block fills,
// dark mode brightens; the text color is fixed per theme so every step along the
// ramp clears 4.5:1 against its own background.
const HEATMAP_HUE = 192;
const HEATMAP_TEXT_LIGHT = "#104e64"; // cyan-900
const HEATMAP_TEXT_DARK = "#cefafe"; // cyan-100

/**
 * Calculate heatmap color based on fill ratio.
 * Fuller blocks are always more saturated than emptier ones, which is what the
 * legend promises. The legend chips are generated from this same function so
 * the two cannot drift apart.
 */
export function getHeatmapStyles(
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

	// One continuous ramp for every partially or fully filled block, so a full
	// block is never rendered lighter than a nearly-full one.
	const saturation = isDarkMode
		? Math.round(45 + clampedRatio * 38) // 45% to 83%
		: Math.round(55 + clampedRatio * 35); // 55% to 90%

	const bgLightness = isDarkMode
		? Math.round(13 + clampedRatio * 16) // 13% to 29%
		: Math.round(96 - clampedRatio * 38); // 96% to 58%

	const borderLightness = isDarkMode
		? Math.round(30 + clampedRatio * 25) // 30% to 55%
		: Math.round(70 - clampedRatio * 35); // 70% to 35%

	const bgOpacity = isDarkMode ? 0.4 + clampedRatio * 0.42 : 1;

	return {
		className: "hover:scale-[1.02]",
		style: {
			borderColor: `hsl(${HEATMAP_HUE}, ${saturation}%, ${borderLightness}%)`,
			backgroundColor: `hsla(${HEATMAP_HUE}, ${saturation}%, ${bgLightness}%, ${bgOpacity})`,
			color: isDarkMode ? HEATMAP_TEXT_DARK : HEATMAP_TEXT_LIGHT,
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
									className="sticky top-0 z-20 bg-background p-2 border-b"
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
							return (
								<tr key={blockStart}>
									<td className="sticky left-0 z-10 bg-background p-2 border-r">
										<div className="flex items-center justify-end flex-wrap pr-1 text-xs text-muted-foreground font-medium whitespace-nowrap">
											{formatCompactTime(blockStart)}
											{blockStart <= currentTime.timeMinutes &&
												currentTime.timeMinutes < blockStart + blockSize && (
													<span className="ml-1 text-primary">(Now)</span>
												)}
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
													<span className="text-[10px]">
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
