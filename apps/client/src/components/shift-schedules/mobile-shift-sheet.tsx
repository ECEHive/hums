import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { ShiftCard } from "./shift-card";
import {
	DAYS_OF_WEEK,
	formatCompactTime,
	type ShiftSchedule,
} from "./shift-scheduler-utils";
import { useShiftMutations } from "./use-shift-mutations";

interface MobileShiftSheetProps {
	open: boolean;
	onClose: () => void;
	schedules: ShiftSchedule[];
	dayOfWeek: number;
	timeBlock: number;
	periodId: number;
	isWithinSignupWindow: boolean;
}

export function MobileShiftSheet({
	open,
	onClose,
	schedules,
	dayOfWeek,
	timeBlock,
	periodId,
	isWithinSignupWindow,
}: MobileShiftSheetProps) {
	const day = DAYS_OF_WEEK.find((d) => d.value === dayOfWeek);
	const timeLabel = formatCompactTime(timeBlock);
	const { registerMutation, unregisterMutation } = useShiftMutations(periodId);

	return (
		<Sheet
			open={open}
			onOpenChange={(isOpen) => {
				if (!isOpen) onClose();
			}}
		>
			<SheetContent
				side="bottom"
				className="h-[85vh] overflow-hidden p-0 [&>button]:hidden"
			>
				<SheetHeader className="relative border-b px-4 py-3">
					<Button
						variant="ghost"
						size="icon"
						onClick={onClose}
						className="absolute right-2 top-2 h-14 w-14"
					>
						<X className="h-5 w-5" />
						<span className="sr-only">Close</span>
					</Button>
					<SheetTitle>
						{day?.label} at {timeLabel}
					</SheetTitle>
					<SheetDescription>
						{schedules.length} shift{schedules.length !== 1 ? "s" : ""}{" "}
						available
					</SheetDescription>
				</SheetHeader>

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
			</SheetContent>
		</Sheet>
	);
}
