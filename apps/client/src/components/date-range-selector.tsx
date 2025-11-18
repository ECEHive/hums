import type * as React from "react";
import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	formatLocalInput,
	formatLocalRange,
	getAppTimezoneDisplayLabel,
	isUserInAppTimezone,
} from "@/lib/timezone";

type Range = [Date | undefined, Date | undefined];

export type DateRangeSelectorProps = {
	value?: Range;
	onChange?: (range: Range) => void;
	disabled?: boolean;
	// optional label to show above the control when embedded in a form cell
	label?: React.ReactNode;
	// whether to show time selection
	withTime?: boolean;
};

const DateRangeSelector: React.FC<DateRangeSelectorProps> = ({
	value,
	onChange,
	disabled,
	label,
	withTime = false,
}) => {
	const startTimeId = useId();
	const endTimeId = useId();
	const [open, setOpen] = useState(false);
	const [range, setRange] = useState<Range>(value ?? [undefined, undefined]);
	const [startTime, setStartTime] = useState("00:00");
	const [endTime, setEndTime] = useState("23:59");

	useEffect(() => {
		setRange(value ?? [undefined, undefined]);
		// Extract time from dates if they exist
		if (value?.[0]) {
			setStartTime(
				`${value[0].getHours().toString().padStart(2, "0")}:${value[0]
					.getMinutes()
					.toString()
					.padStart(2, "0")}`,
			);
		}
		if (value?.[1]) {
			setEndTime(
				`${value[1].getHours().toString().padStart(2, "0")}:${value[1]
					.getMinutes()
					.toString()
					.padStart(2, "0")}`,
			);
		}
	}, [value]);

	const display = () => {
		const [s, e] = range;
		if (!s && !e) return "Pick a date range";
		if (s && !e) {
			return formatLocalInput(s, {
				formatString: withTime ? undefined : "MMM D, YYYY",
				includeTimezoneWhenDifferent: withTime,
				// Value came directly from the picker, so treat it as local input
				treatAsLocalInput: true,
			});
		}
		if (s && e) {
			return formatLocalRange(s, e, {
				includeTime: withTime,
			});
		}
		return "Pick a date range";
	};

	const updateTimeOnDate = (
		date: Date | undefined,
		time: string,
	): Date | undefined => {
		if (!date) return undefined;
		const [hours, minutes] = time.split(":").map(Number);
		const newDate = new Date(date);
		newDate.setHours(hours, minutes, 0, 0);
		return newDate;
	};

	const handleTimeChange = (type: "start" | "end", time: string) => {
		if (type === "start") {
			setStartTime(time);
			if (range[0]) {
				const newStart = updateTimeOnDate(range[0], time);
				const newRange: Range = [newStart, range[1]];
				setRange(newRange);
				onChange?.(newRange);
			}
		} else {
			setEndTime(time);
			if (range[1]) {
				const newEnd = updateTimeOnDate(range[1], time);
				const newRange: Range = [range[0], newEnd];
				setRange(newRange);
				onChange?.(newRange);
			}
		}
	};

	const handleClear = () => {
		setRange([undefined, undefined]);
		setStartTime("00:00");
		setEndTime("23:59");
		onChange?.([undefined, undefined]);
	};

	return (
		<div>
			{label && <span className="text-sm font-medium block mb-1">{label}</span>}
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger asChild>
					<Button
						type="button"
						variant="outline"
						disabled={disabled}
						className="w-full justify-start text-left font-normal overflow-hidden"
						title={display()}
					>
						<span className="truncate block">{display()}</span>
					</Button>
				</PopoverTrigger>
				<PopoverContent className="w-auto p-0" align="start">
					<div className="flex flex-col items-center p-4 space-y-3">
						<div className="flex items-center justify-between mb-2">
							<span className="text-sm font-medium">Select range</span>
							<Button
								variant="ghost"
								size="sm"
								onClick={handleClear}
								disabled={!range[0] && !range[1]}
							>
								Clear
							</Button>
						</div>
						{!isUserInAppTimezone && (
							<p className="text-xs text-muted-foreground">
								All selections use {getAppTimezoneDisplayLabel()}.
							</p>
						)}
						<Calendar
							mode="range"
							selected={range ? { from: range[0], to: range[1] } : undefined}
							onSelect={(r: { from?: Date; to?: Date } | Date | undefined) => {
								if (!r) return;
								if (
									typeof r === "object" &&
									(r as { from?: Date }).from !== undefined
								) {
									let start = (r as { from?: Date; to?: Date }).from;
									let end = (r as { from?: Date; to?: Date }).to;

									// Apply times if withTime is enabled
									if (withTime) {
										start = updateTimeOnDate(start, startTime);
										end = updateTimeOnDate(end, endTime);
									}

									const nn: Range = [start, end];
									setRange(nn);
									onChange?.(nn);
								} else if (r instanceof Date) {
									let date = r;
									if (withTime) {
										date = updateTimeOnDate(date, startTime) || date;
									}
									const nn: Range = [date, date];
									setRange(nn);
									onChange?.(nn);
								}
							}}
						/>
						{withTime && (
							<div className="flex flex-row border-t pt-4 space-x-2">
								<div className="space-y-2">
									<label htmlFor={startTimeId} className="text-sm font-medium">
										Start Time
									</label>
									<Input
										id={startTimeId}
										type="time"
										value={startTime}
										onChange={(e) => handleTimeChange("start", e.target.value)}
										disabled={!range[0]}
										className="h-8"
									/>
								</div>
								<div className="space-y-2">
									<label htmlFor={endTimeId} className="text-sm font-medium">
										End Time
									</label>
									<Input
										id={endTimeId}
										type="time"
										value={endTime}
										onChange={(e) => handleTimeChange("end", e.target.value)}
										disabled={!range[1]}
										className="h-8"
									/>
								</div>
							</div>
						)}
					</div>
				</PopoverContent>
			</Popover>
		</div>
	);
};

export default DateRangeSelector;
