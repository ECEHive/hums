import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";

interface ColorPickerProps {
	value: string;
	onChange: (value: string) => void;
	disabled?: boolean;
}

/**
 * Color picker component for configuration fields.
 * Supports both a native color input and manual hex input.
 */
export function ColorPicker({ value, onChange, disabled }: ColorPickerProps) {
	const [inputValue, setInputValue] = useState(value);

	// Update local state when external value changes
	const handleInputChange = useCallback(
		(newValue: string) => {
			setInputValue(newValue);
			// Only update parent if it's a valid hex color
			if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.test(newValue)) {
				onChange(newValue);
			}
		},
		[onChange],
	);

	const handleColorPickerChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const newValue = e.target.value;
			setInputValue(newValue);
			onChange(newValue);
		},
		[onChange],
	);

	// Sync input value when prop changes
	if (
		value !== inputValue &&
		/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.test(value)
	) {
		setInputValue(value);
	}

	return (
		<div className="flex items-center gap-2">
			<Popover>
				<PopoverTrigger asChild>
					<Button
						variant="outline"
						className="w-10 h-9 p-0 border-2"
						style={{ backgroundColor: value }}
						disabled={disabled}
						type="button"
					>
						<span className="sr-only">Pick a color</span>
					</Button>
				</PopoverTrigger>
				<PopoverContent className="w-auto p-3" align="start">
					<div className="space-y-3">
						<input
							type="color"
							value={value}
							onChange={handleColorPickerChange}
							disabled={disabled}
							className="w-32 h-32 cursor-pointer rounded border-0 p-0"
						/>
						<div className="text-xs text-muted-foreground text-center">
							Click to select a color
						</div>
					</div>
				</PopoverContent>
			</Popover>
			<Input
				type="text"
				value={inputValue}
				onChange={(e) => handleInputChange(e.target.value)}
				placeholder="#000000"
				disabled={disabled}
				className="font-mono"
			/>
			<div
				className="w-9 h-9 rounded border flex-shrink-0"
				style={{ backgroundColor: value }}
				title={`Preview: ${value}`}
			/>
		</div>
	);
}
