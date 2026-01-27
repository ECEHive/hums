import { CalendarDays } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { OverviewShiftCard } from "./overview-shift-card";
import {
	DAYS_OF_WEEK,
	formatCompactTime,
	type OverviewSchedule,
} from "./overview-utils";

interface OverviewSidebarProps {
	schedules: OverviewSchedule[];
	dayOfWeek: number;
	timeBlock: number;
}

// Minimum width in pixels to switch to grid layout (2 columns)
const GRID_BREAKPOINT = 500;
// Width at which we switch to 3 columns
const THREE_COLUMN_BREAKPOINT = 750;

export function OverviewSidebar({
	schedules,
	dayOfWeek,
	timeBlock,
}: OverviewSidebarProps) {
	const day = DAYS_OF_WEEK.find((d) => d.value === dayOfWeek);
	const timeLabel = formatCompactTime(timeBlock);
	const containerRef = useRef<HTMLDivElement>(null);
	const [columns, setColumns] = useState(1);

	const updateColumns = useCallback(() => {
		if (containerRef.current) {
			const width = containerRef.current.offsetWidth;
			if (width >= THREE_COLUMN_BREAKPOINT) {
				setColumns(3);
			} else if (width >= GRID_BREAKPOINT) {
				setColumns(2);
			} else {
				setColumns(1);
			}
		}
	}, []);

	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;

		updateColumns();

		const resizeObserver = new ResizeObserver(updateColumns);
		resizeObserver.observe(container);

		return () => {
			resizeObserver.disconnect();
		};
	}, [updateColumns]);

	const totalSlots = schedules.reduce((sum, s) => sum + s.slots, 0);
	const filledSlots = schedules.reduce((sum, s) => sum + s.filledSlots, 0);

	return (
		<div className="flex h-full flex-col" ref={containerRef}>
			<div className="border-b bg-card p-4">
				<h3 className="text-lg font-semibold">
					{day?.label} at {timeLabel}
				</h3>
				<p className="text-sm text-muted-foreground">
					{schedules.length} shift type{schedules.length !== 1 ? "s" : ""} •{" "}
					{filledSlots}/{totalSlots} slots filled
				</p>
			</div>

			<div
				className={cn(
					"flex-1 overflow-y-auto p-4 pb-24",
					columns === 1 && "space-y-3",
					columns > 1 && "grid gap-3",
				)}
				style={
					columns > 1
						? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }
						: undefined
				}
			>
				{schedules.map((schedule) => (
					<OverviewShiftCard key={schedule.id} schedule={schedule} />
				))}
			</div>
		</div>
	);
}

export function OverviewSidebarEmpty() {
	return (
		<div className="flex h-full items-center justify-center p-8 text-center text-muted-foreground">
			<div>
				<CalendarDays className="mx-auto mb-3 h-10 w-10 opacity-50" />
				<p className="text-sm">Select a time slot to view details</p>
			</div>
		</div>
	);
}
