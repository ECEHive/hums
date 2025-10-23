import { ClockIcon } from "lucide-react";
import type * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface TimeInputProps {
	value: string;
	onChange: (value: string) => void;
	className?: string;
	placeholder?: string;
	id?: string;
	name?: string;
	onBlur?: () => void;
	"aria-invalid"?: boolean;
}

export function TimeInput({
	value,
	onChange,
	className,
	placeholder = "HH:MM",
	id,
	name,
	onBlur,
	"aria-invalid": ariaInvalid,
}: TimeInputProps) {
	// Strip seconds if present (e.g., "10:00:00" -> "10:00")
	const displayValue = value.includes(":")
		? value.split(":").slice(0, 2).join(":")
		: value;

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		let input = e.target.value;

		// Remove any non-numeric and non-colon characters
		input = input.replace(/[^0-9:]/g, "");

		// Automatically add colon after 2 digits
		if (input.length === 2 && !input.includes(":")) {
			input = `${input}:`;
		}

		// Limit to HH:MM format (5 characters)
		if (input.length > 5) {
			input = input.slice(0, 5);
		}

		onChange(input);
	};

	const handleBlur = () => {
		// Validate and format on blur
		const parts = displayValue.split(":");
		if (parts.length === 2) {
			const hours = parts[0].padStart(2, "0");
			const minutes = parts[1].padStart(2, "0");

			// Validate ranges
			const h = Number.parseInt(hours, 10);
			const m = Number.parseInt(minutes, 10);

			if (
				!Number.isNaN(h) &&
				!Number.isNaN(m) &&
				h >= 0 &&
				h < 24 &&
				m >= 0 &&
				m < 60
			) {
				onChange(`${hours}:${minutes}`);
			}
		}
		onBlur?.();
	};

	return (
		<div className="relative">
			<ClockIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
			<Input
				type="text"
				value={displayValue}
				onChange={handleChange}
				onBlur={handleBlur}
				placeholder={placeholder}
				className={cn("pl-9", className)}
				id={id}
				name={name}
				aria-invalid={ariaInvalid}
				maxLength={5}
			/>
		</div>
	);
}
