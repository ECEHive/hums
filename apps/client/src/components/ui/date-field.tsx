import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Field, FieldLabel } from "@/components/ui/field";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";

// Minimal shape of the field object provided by @tanstack/react-form's form.Field
export type FormField<T> = {
	name: string;
	handleBlur: () => void;
	handleChange: (value: T | null) => void;
	state: {
		value: T | null;
		meta: {
			isTouched: boolean;
			isValid: boolean;
			// errors shape is provided by @tanstack/react-form and can be complex/undefined
			errors: unknown;
		};
	};
};

type DateFieldProps = {
	label?: React.ReactNode;
	field: FormField<Date>;
	disabledDate?: (date: Date) => boolean;
};

export function DateField({ label, field, disabledDate }: DateFieldProps) {
	const value: Date | null = field.state.value || null;
	const [open, setOpen] = useState(false);

	return (
		<Field>
			{label ? <FieldLabel htmlFor={field.name}>{label}</FieldLabel> : null}
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger asChild>
					<Button
						id={field.name}
						type="button"
						variant="outline"
						className={`w-full justify-start text-left font-normal ${
							!value ? "text-muted-foreground" : ""
						}`}
					>
						<CalendarIcon className="mr-2 h-4 w-4" />
						{value ? format(value, "PPP") : <span>Pick a date</span>}
					</Button>
				</PopoverTrigger>
				<PopoverContent className="w-auto p-0" align="start">
					<Calendar
						mode="single"
						selected={value || undefined}
						onSelect={(date) => {
							field.handleChange(date || null);
							setOpen(false);
						}}
						disabled={disabledDate}
					/>
				</PopoverContent>
			</Popover>
		</Field>
	);
}

export default DateField;
