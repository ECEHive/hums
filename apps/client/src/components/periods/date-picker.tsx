import { ChevronDownIcon } from "lucide-react";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";

interface DatePickerProps {
	label?: string;
	value?: Date;
	onChange?: (date: Date | undefined) => void;
}

export function DatePicker({
	label = "Select date",
	value,
	onChange,
}: DatePickerProps) {
	const [open, setOpen] = useState(false);
	const [internalDate, setInternalDate] = useState<Date | undefined>(value);

	const labelId = useId();
	const buttonId = useId();

	const date = value !== undefined ? value : internalDate;

	const handleSelect = (selectedDate: Date | undefined) => {
		if (onChange) {
			onChange(selectedDate);
		} else {
			setInternalDate(selectedDate);
		}
		setOpen(false);
	};

	return (
		<div className="flex flex-col gap-3">
			<Label htmlFor={labelId} className="px-1">
				{label}
			</Label>
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger asChild>
					<Button
						variant="outline"
						id={buttonId}
						className="w-48 justify-between font-normal"
					>
						{date ? date.toLocaleDateString() : "Select date"}
						<ChevronDownIcon />
					</Button>
				</PopoverTrigger>
				<PopoverContent className="w-auto overflow-hidden p-0" align="start">
					<Calendar
						mode="single"
						selected={date}
						captionLayout="dropdown"
						onSelect={handleSelect}
					/>
				</PopoverContent>
			</Popover>
		</div>
	);
}
