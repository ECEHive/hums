import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OverviewShiftCard } from "./overview-shift-card";
import {
	DAYS_OF_WEEK,
	formatCompactTime,
	type OverviewSchedule,
} from "./overview-utils";

interface OverviewMobileSheetProps {
	open: boolean;
	schedules: OverviewSchedule[];
	dayOfWeek: number;
	timeBlock: number;
	onClose: () => void;
}

export function OverviewMobileSheet({
	open,
	schedules,
	dayOfWeek,
	timeBlock,
	onClose,
}: OverviewMobileSheetProps) {
	const day = DAYS_OF_WEEK.find((d) => d.value === dayOfWeek);
	const timeLabel = formatCompactTime(timeBlock);

	const totalSlots = schedules.reduce((sum, s) => sum + s.slots, 0);
	const filledSlots = schedules.reduce((sum, s) => sum + s.filledSlots, 0);

	if (!open) return null;

	return (
		<div className="fixed inset-0 z-50 flex flex-col bg-background animate-in slide-in-from-bottom duration-300">
			{/* Header */}
			<div className="flex items-center justify-between border-b p-4">
				<div>
					<h2 className="text-lg font-semibold">
						{day?.label} at {timeLabel}
					</h2>
					<p className="text-sm text-muted-foreground">
						{schedules.length} shift type{schedules.length !== 1 ? "s" : ""} •{" "}
						{filledSlots}/{totalSlots} slots filled
					</p>
				</div>
				<Button variant="ghost" size="icon" onClick={onClose}>
					<X className="h-5 w-5" />
				</Button>
			</div>

			{/* Content */}
			<div className="flex-1 space-y-3 overflow-y-auto p-4 pb-24">
				{schedules.map((schedule) => (
					<OverviewShiftCard key={schedule.id} schedule={schedule} />
				))}
			</div>
		</div>
	);
}
