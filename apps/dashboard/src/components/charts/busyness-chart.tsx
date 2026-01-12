import { Activity, Clock, TrendingDown, TrendingUp, Users } from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { Bar, BarChart, Cell, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "@/components/ui/chart";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface HourlyData {
	hour: number;
	averageCount: number;
	maxCount: number;
}

interface DayAnalytics {
	dayOfWeek: number;
	dayName: string;
	hourlyData: HourlyData[];
}

interface CurrentBusyness {
	count: number;
	typicalCount: number;
	comparison: "busier" | "quieter" | "typical";
}

interface BusynessChartProps {
	data: DayAnalytics[];
	current?: CurrentBusyness;
}

// Using accessible colors that work on both light and dark backgrounds
const chartConfig = {
	average: {
		label: "Average visitors",
		color: "hsl(220 70% 50%)", // Blue that works on both themes
	},
	current: {
		label: "Current hour",
		color: "hsl(142 76% 36%)", // Green for current hour
	},
} satisfies ChartConfig;

// Color scale based on busyness level (Google Maps style)
function getBusynessColor(
	value: number,
	maxValue: number,
	isCurrent: boolean,
	isDark: boolean,
): string {
	if (isCurrent) {
		// Bright, accessible green for current hour
		return isDark ? "hsl(142 76% 45%)" : "hsl(142 76% 36%)";
	}

	// Gradient from light to dark blue based on busyness
	// LIGHT = less busy, DARK = more busy
	const ratio = maxValue > 0 ? value / maxValue : 0;

	// Use different color scales for light and dark mode for better visibility
	if (isDark) {
		// Dark mode: lighter colors are less busy, brighter/more saturated are more busy
		if (ratio < 0.25) {
			return "hsl(220 60% 90%)";  // Desaturated blue for low activity
		}
		if (ratio < 0.5) {
			return "hsl(220 65% 75%)";  // Medium saturation
		}
		if (ratio < 0.75) {
			return "hsl(220 70% 60%)"; // Higher saturation
		}
		return "hsl(220 75% 45%)"; // Most saturated/bright for high activity
	} else {
		// Light mode: lighter colors are less busy, darker are more busy
		if (ratio < 0.25) {
			return "hsl(220 60% 90%)"; // Very light blue for low activity
		}
		if (ratio < 0.5) {
			return "hsl(220 65% 75%)"; // Light blue
		}
		if (ratio < 0.75) {
			return "hsl(220 70% 60%)"; // Medium blue
		}
		return "hsl(220 75% 45%)"; // Dark blue for high activity
	}
}

// Custom tick component that respects theme colors
function CustomTick({ x, y, payload }: { x?: number; y?: number; payload?: { value: string | number } }) {
	return (
		<text
			x={x}
			y={y}
			fill="currentColor"
			className="fill-muted-foreground text-[10px]"
			textAnchor="middle"
			dy={4}
		>
			{payload?.value}
		</text>
	);
}

// Custom Y-axis tick component
function CustomYTick({ x, y, payload }: { x?: number; y?: number; payload?: { value: string | number } }) {
	return (
		<text
			x={x}
			y={y}
			fill="currentColor"
			className="fill-muted-foreground text-[10px]"
			textAnchor="end"
			dy={3}
		>
			{payload?.value}
		</text>
	);
}

export function BusynessChart({ data, current }: BusynessChartProps) {
	const today = new Date().getDay();
	const currentHour = new Date().getHours();
	const [selectedDay, setSelectedDay] = useState(today);
	const [isDark, setIsDark] = useState(false);

	// Detect theme changes
	useEffect(() => {
		const checkTheme = () => {
			setIsDark(document.documentElement.classList.contains("dark"));
		};
		
		checkTheme();
		
		// Watch for theme changes
		const observer = new MutationObserver(checkTheme);
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["class"],
		});
		
		return () => observer.disconnect();
	}, []);

	const dayData = data.find((d) => d.dayOfWeek === selectedDay);

	// Find max value for color scaling
	const maxAverage = useMemo(() => {
		return Math.max(
			...(dayData?.hourlyData.map((h) => h.averageCount) ?? [1]),
			1,
		);
	}, [dayData]);

	// Format data for chart - only show business hours (6am to 11pm)
	const chartData = useMemo(() => {
		return (
			dayData?.hourlyData
				.filter((h) => h.hour >= 6 && h.hour <= 23)
				.map((h) => ({
					hour: formatHour(h.hour),
					hourNum: h.hour,
					average: h.averageCount,
					max: h.maxCount,
					isCurrent: selectedDay === today && h.hour === currentHour,
				})) ?? []
		);
	}, [dayData, selectedDay, today, currentHour]);

	const getComparisonBadge = () => {
		if (!current) return null;
		const { comparison } = current;

		if (comparison === "busier") {
			return (
				<Badge className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 border-orange-200 dark:border-orange-800">
					<TrendingUp className="h-4 w-4" />
					<span>Currently More Busy than Normal</span>
				</Badge>
			);
		}
		if (comparison === "quieter") {
			return (
				<Badge className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">
					<TrendingDown className="h-4 w-4" />
					<span>Currently Less Busy than Normal</span>
				</Badge>
			);
		}
		return (
			<Badge
				variant="outline"
				className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-muted/50"
			>
				<Activity className="h-4 w-4" />
				<span>Currently About Typical</span>
			</Badge>
		);
	};

	return (
		<div className="space-y-4">
			{/* Day selector and comparison badge */}
			<div className="flex flex-col gap-4">
				{/* Day selector - Using Tabs component */}
				<Tabs
					value={selectedDay.toString()}
					onValueChange={(value) => setSelectedDay(parseInt(value, 10))}
					className="w-full"
				>
					<TabsList className="grid w-full grid-cols-7 h-10">
						{data.map((day) => (
							<TabsTrigger
								key={day.dayOfWeek}
								value={day.dayOfWeek.toString()}
								className={cn(
									"text-xs sm:text-sm px-1 sm:px-3 transition-all",
									day.dayOfWeek === today &&
										"font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground",
								)}
							>
								<span className="hidden sm:inline">
									{day.dayName.slice(0, 3)}
								</span>
								<span className="sm:hidden">{day.dayName.slice(0, 1)}</span>
							</TabsTrigger>
						))}
					</TabsList>
				</Tabs>

				{/* Comparison badge - only show for today */}
				{selectedDay === today && current && (
					<div className="flex justify-center sm:justify-start">
						{getComparisonBadge()}
					</div>
				)}
			</div>

			{/* Chart */}
			<div className="relative">
				<ChartContainer
					config={chartConfig}
					className="h-[160px] sm:h-[200px] w-full"
				>
					<BarChart
						data={chartData}
						margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
					>
						<XAxis
							dataKey="hour"
							tickLine={false}
							axisLine={false}
							interval={2}
							tick={<CustomTick />}
						/>
						<YAxis
							tickLine={false}
							axisLine={false}
							width={32}
							tickFormatter={(value) => Math.round(value).toString()}
							tick={<CustomYTick />}
						/>
						<ChartTooltip
							cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }}
							content={
								<ChartTooltipContent
									formatter={(value, _name, item) => {
										const entry = (item as { payload?: (typeof chartData)[0] })?.payload;
										return (
											<div className="flex flex-col gap-1">
												<div className="flex items-center gap-2">
													<Users className="h-3 w-3 text-muted-foreground" />
													<span className="font-medium">
														~{typeof value === "number" ? value.toFixed(1) : value}{" "}
														people
													</span>
												</div>
												{entry?.isCurrent && (
													<div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
														<Clock className="h-3 w-3" />
														<span>Current hour</span>
													</div>
												)}
											</div>
										);
									}}
									labelFormatter={(label) => (
										<span className="font-semibold text-foreground">
											{label}
										</span>
									)}
								/>
							}
						/>
						<Bar dataKey="average" radius={[4, 4, 0, 0]} maxBarSize={32}>
							{chartData.map((entry, index) => (
								<Cell
									key={`cell-${index}`}
									fill={getBusynessColor(
										entry.average,
										maxAverage,
										entry.isCurrent,
										isDark,
									)}
									className="transition-all duration-200"
								/>
							))}
						</Bar>
					</BarChart>
				</ChartContainer>		</div>
			{/* Legend */}
			<div className="flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
				{selectedDay === today && (
					<div className="flex items-center gap-1.5">
						<div className="w-3 h-3 rounded-sm bg-emerald-500 dark:bg-emerald-400" />
						<span>Now ({formatHour(currentHour)})</span>
					</div>
				)}
				<div className="flex items-center gap-1.5">
					<div className="flex gap-0.5">
					<div className="w-2 h-3 rounded-sm bg-[hsl(220_60%_90%)]" />
					<div className="w-2 h-3 rounded-sm bg-[hsl(220_65%_75%)]" />
					<div className="w-2 h-3 rounded-sm bg-[hsl(220_70%_60%)]" />
					</div>
					<span>Less to more busy</span>
				</div>
			</div>

			{/* Historical note */}
			{selectedDay !== today && (
				<p className="text-xs text-muted-foreground text-center">
					Based on typical activity for{" "}
					{data.find((d) => d.dayOfWeek === selectedDay)?.dayName}s
				</p>
			)}
		</div>
	);
}

function formatHour(hour: number): string {
	if (hour === 0) return "12a";
	if (hour === 12) return "12p";
	if (hour < 12) return `${hour}a`;
	return `${hour - 12}p`;
}
