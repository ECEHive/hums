import { CalendarDays } from "lucide-react";
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

	return (
		<div className="flex h-full flex-col">
			<div className="border-b bg-card p-4">
				<h3 className="text-lg font-semibold">
					{day?.label} at {timeLabel}
				</h3>
				<p className="text-sm text-muted-foreground">
					{schedules.length} shift{schedules.length !== 1 ? "s" : ""} available
				</p>
			</div>

			<div className="flex-1 space-y-3 overflow-y-auto p-4 pb-24">
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
