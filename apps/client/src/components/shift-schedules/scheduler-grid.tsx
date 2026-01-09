import { useEffect, useState } from "react";
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

/**
 * Calculates a gradient color and styles based on availability ratio.
 * Returns CSS classes and inline styles for the slot button.
 *
 * Accessibility considerations:
 * - Uses both color AND numeric indicator to ensure distinguishability
 * - Maintains sufficient contrast ratios for text
 * - Provides descriptive aria-label for screen readers
 * - Color alone is not the sole indicator (numbers always shown)
 *
 * The gradient transitions from:
 * - 100% available: Bright green (high saturation)
 * - 50% available: Muted green
 * - 0% available: Gray (matches "full" state)
 */
function getAvailabilityStyles(
	available: number,
	total: number,
	isDarkMode = false,
): {
	className: string;
	style: React.CSSProperties;
	ariaLabel: string;
} {
	// Calculate ratio (0 = empty, 1 = all slots available)
	const ratio = total > 0 ? available / total : 0;

	// Clamp ratio to [0, 1]
	const clampedRatio = Math.max(0, Math.min(1, ratio));

	// For full slots (ratio = 0), use muted gray
	if (available === 0) {
		return {
			className: "border-muted bg-muted/40 text-muted-foreground",
			style: {},
			ariaLabel: `No slots available out of ${total} total`,
		};
	}

	// HSL values for gradient interpolation
	// Green (full availability): hsl(142, 76%, 36%) in light, hsl(142, 70%, 45%) in dark
	// Gray (no availability): hsl(0, 0%, 50%)
	const hue = 142; // Green hue constant

	// Saturation: 0% (gray) to max (green) based on ratio
	const maxSaturation = isDarkMode ? 70 : 76;
	const saturation = Math.round(clampedRatio * maxSaturation);

	// For light mode: text gets darker as more saturated (better contrast)
	// For dark mode: text gets lighter as more saturated
	const textLightness = isDarkMode
		? Math.round(45 + clampedRatio * 25) // 45% to 70%
		: Math.round(45 - clampedRatio * 15); // 45% to 30%

	// Background lightness
	const bgLightness = isDarkMode
		? Math.round(15 + clampedRatio * 5) // 15% to 20%
		: Math.round(97 - clampedRatio * 7); // 97% to 90%

	// Border lightness - more visible as availability increases
	const borderLightness = isDarkMode
		? Math.round(35 + clampedRatio * 15) // 35% to 50%
		: Math.round(55 - clampedRatio * 15); // 55% to 40%

	// Border opacity increases with availability
	const borderOpacity = 0.4 + clampedRatio * 0.35; // 0.4 to 0.75

	// Background opacity
	const bgOpacity = isDarkMode ? 0.3 + clampedRatio * 0.15 : 1;

	return {
		className: "hover:scale-[1.02] dark:[--availability-computed:1]",
		style: {
			"--availability-ratio": clampedRatio,
			borderColor: `hsla(${hue}, ${saturation}%, ${borderLightness}%, ${borderOpacity})`,
			backgroundColor: isDarkMode
				? `hsla(${hue}, ${saturation}%, ${bgLightness}%, ${bgOpacity})`
				: `hsl(${hue}, ${saturation}%, ${bgLightness}%)`,
			color: `hsl(${hue}, ${Math.round(saturation * 0.85)}%, ${textLightness}%)`,
		} as React.CSSProperties,
		ariaLabel: `${available} of ${total} slots available (${Math.round(clampedRatio * 100)}% open)`,
	};
}

/**
 * Hook to detect dark mode by observing the document's class list.
 * Returns true if dark mode is active.
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

export function SchedulerGrid({
	visibleDays,
	timeBlockStarts,
	blocks,
	selectedBlock,
	onSelectBlock,
}: SchedulerGridProps) {
	const isDarkMode = useIsDarkMode();

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

									// Get gradient styles based on availability ratio
									const availabilityStyles = getAvailabilityStyles(
										blockData.available,
										blockData.total,
										isDarkMode,
									);

									// Determine if user can't register due to restrictions (not just full)
									const hasRestrictions =
										!hasAvailable &&
										!isTrulyFull &&
										blockData.schedules.some(
											(s) =>
												!s.canRegister ||
												!s.meetsRoleRequirement ||
												!s.meetsBalancingRequirement ||
												s.hasTimeOverlap,
										);

									return (
										<td key={key} className="p-1">
											<button
												type="button"
												onClick={() => onSelectBlock(day.value, blockStart)}
												aria-label={
													isRegistered
														? "You are registered for this shift"
														: hasAvailable
															? availabilityStyles.ariaLabel
															: isTrulyFull
																? "This shift is full"
																: "This shift is unavailable due to restrictions"
												}
												aria-pressed={isSelected}
												className={cn(
													"w-full h-12 rounded-lg border-2 transition-all flex items-center justify-center gap-2 px-2 active:scale-[0.98]",
													isSelected && "ring-2 ring-offset-2 ring-primary",
													isRegistered
														? "border-primary bg-primary text-primary-foreground hover:scale-[1.02]"
														: hasAvailable
															? availabilityStyles.className
															: hasRestrictions
																? "border-amber-500/40 bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 hover:scale-[1.02]"
																: availabilityStyles.className,
												)}
												style={
													!isRegistered &&
													(hasAvailable || (!hasRestrictions && isTrulyFull))
														? availabilityStyles.style
														: undefined
												}
											>
												{isRegistered ? (
													<span
														className="text-lg font-bold"
														aria-hidden="true"
													>
														✓
													</span>
												) : isTrulyFull && !hasRestrictions ? (
													<span className="text-xs">full</span>
												) : hasAvailable ? (
													<>
														<span className="text-lg font-bold tabular-nums">
															{blockData.available}
														</span>
														<span className="text-xs">open</span>
													</>
												) : (
													<span className="text-xs">unavailable</span>
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
