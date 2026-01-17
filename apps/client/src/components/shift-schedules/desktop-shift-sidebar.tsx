import { CalendarDays } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { ShiftCard } from "./shift-card";
import {
	DAYS_OF_WEEK,
	formatCompactTime,
	type ShiftSchedule,
} from "./shift-scheduler-utils";
import { useShiftMutations } from "./use-shift-mutations";

interface DesktopShiftSidebarProps {
	schedules: ShiftSchedule[];
	dayOfWeek: number;
	timeBlock: number;
	periodId: number;
	isWithinSignupWindow: boolean;
}

// Minimum width in pixels to switch to grid layout (2 columns)
const GRID_BREAKPOINT = 500;
// Width at which we switch to 3 columns
const THREE_COLUMN_BREAKPOINT = 750;

export function DesktopShiftSidebar({
	schedules,
	dayOfWeek,
	timeBlock,
	periodId,
	isWithinSignupWindow,
}: DesktopShiftSidebarProps) {
	const day = DAYS_OF_WEEK.find((d) => d.value === dayOfWeek);
	const timeLabel = formatCompactTime(timeBlock);
	const { registerMutation, unregisterMutation } = useShiftMutations(periodId);
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

		// Initial measurement
		updateColumns();

		// Watch for resize
		const resizeObserver = new ResizeObserver(updateColumns);
		resizeObserver.observe(container);

		return () => {
			resizeObserver.disconnect();
		};
	}, [updateColumns]);

	return (
		<div className="flex h-full flex-col" ref={containerRef}>
			<div className="border-b bg-card p-4">
				<h3 className="text-lg font-semibold">
					{day?.label} at {timeLabel}
				</h3>
				<p className="text-sm text-muted-foreground">
					{schedules.length} shift{schedules.length !== 1 ? "s" : ""} available
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
					<ShiftCard
						key={schedule.id}
						schedule={schedule}
						isWithinSignupWindow={isWithinSignupWindow}
						registerMutation={registerMutation}
						unregisterMutation={unregisterMutation}
					/>
				))}
			</div>
		</div>
	);
}

export function DesktopShiftSidebarEmpty() {
	return (
		<div className="flex h-full items-center justify-center p-8 text-center text-muted-foreground">
			<div>
				<CalendarDays className="mx-auto mb-3 h-10 w-10 opacity-50" />
				<p className="text-sm">Select a time slot to view details</p>
			</div>
		</div>
	);
}
