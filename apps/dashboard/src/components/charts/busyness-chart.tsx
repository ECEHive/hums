import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import {
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	ReferenceLine,
	XAxis,
	YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "@/components/ui/chart";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

const chartConfig = {
	average: {
		label: "Avg People",
		color: "var(--chart-1)",
	},
} satisfies ChartConfig;

export function BusynessChart({ data, current }: BusynessChartProps) {
	const today = new Date().getDay();
	const currentHour = new Date().getHours();
	const [selectedDay, setSelectedDay] = useState(today);

	const dayData = data.find((d) => d.dayOfWeek === selectedDay);

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
				<Badge
					variant="destructive"
					className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium"
				>
					<TrendingUp className="h-4 w-4" />
					Busier than usual
				</Badge>
			);
		}
		if (comparison === "quieter") {
			return (
				<Badge
					variant="secondary"
					className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
				>
					<TrendingDown className="h-4 w-4" />
					Quieter than usual
				</Badge>
			);
		}
		return (
			<Badge
				variant="outline"
				className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium"
			>
				<Minus className="h-4 w-4" />
				About typical
			</Badge>
		);
	};

	return (
		<div className="space-y-4">
			{/* Day selector and comparison badge */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
				{/* Day selector - Using Tabs component */}
				<Tabs
					value={selectedDay.toString()}
					onValueChange={(value) => setSelectedDay(parseInt(value, 10))}
					className="w-full sm:w-auto"
				>
					<TabsList className="grid w-full grid-cols-7 h-9">
						{data.map((day) => (
							<TabsTrigger
								key={day.dayOfWeek}
								value={day.dayOfWeek.toString()}
								className={`text-xs px-2 ${
									day.dayOfWeek === today
										? "data-[state=active]:ring-2 data-[state=active]:ring-primary/50"
										: ""
								}`}
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
					<div className="flex-shrink-0 self-start sm:self-auto">
						{getComparisonBadge()}
					</div>
				)}
			</div>

			{/* Chart - Google Maps style */}
			<ChartContainer
				config={chartConfig}
				className="h-[180px] sm:h-[200px] w-full"
			>
				<BarChart
					data={chartData}
					margin={{ top: 20, right: 5, left: -20, bottom: 0 }}
				>
					<CartesianGrid
						vertical={false}
						strokeDasharray="3 3"
						className="stroke-muted/50"
					/>
					<XAxis
						dataKey="hour"
						fontSize={10}
						tickLine={false}
						axisLine={false}
						className="fill-muted-foreground"
						interval={1}
						tick={{ fontSize: 9 }}
					/>
					<YAxis
						fontSize={10}
						tickLine={false}
						axisLine={false}
						className="fill-muted-foreground"
						width={25}
					/>
					<ChartTooltip
						cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }}
						content={
							<ChartTooltipContent
								formatter={(value) => (
									<div className="flex items-center gap-2">
										<div
											className="h-2 w-2 rounded-full"
											style={{ backgroundColor: "var(--chart-1)" }}
										/>
										<span className="text-muted-foreground">Avg:</span>
										<span className="font-medium">
											{typeof value === "number" ? value.toFixed(1) : value}{" "}
											people
										</span>
									</div>
								)}
								labelFormatter={(label) => (
									<span className="font-medium">{label}</span>
								)}
							/>
						}
					/>
					{/* Current time indicator line */}
					{selectedDay === today && (
						<ReferenceLine
							x={formatHour(currentHour)}
							stroke="hsl(var(--primary))"
							strokeWidth={2}
							strokeDasharray="4 4"
						/>
					)}
					<Bar dataKey="average" radius={[4, 4, 0, 0]} maxBarSize={40}>
						{chartData.map((entry, index) => (
							<Cell
								key={`cell-${index}`}
								fill={
									entry.isCurrent ? "hsl(var(--primary))" : "var(--chart-1)"
								}
								fillOpacity={entry.isCurrent ? 1 : 0.8}
							/>
						))}
					</Bar>
				</BarChart>
			</ChartContainer>

			{/* Current time indicator text */}
			{selectedDay === today && (
				<p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-2">
					<span className="inline-block w-3 h-0.5 bg-primary" />
					Current time: {formatHour(currentHour)}
				</p>
			)}

			{/* Historical note */}
			{selectedDay !== today && (
				<p className="text-xs text-muted-foreground text-center">
					Showing typical activity for{" "}
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
