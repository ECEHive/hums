import { RotateCcwIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ColorPicker } from "./color-picker";
import { SvgUpload } from "./svg-upload";

interface ConfigFieldDef {
	key: string;
	label: string;
	description?: string;
	type: string;
	defaultValue: unknown;
	options?: { value: string; label: string }[];
	placeholder?: string;
	min?: number;
	max?: number;
	step?: number;
	required?: boolean;
}

interface ConfigFieldProps {
	field: ConfigFieldDef;
	value: unknown;
	canWrite: boolean;
	onChange: (value: unknown) => void;
	onReset: () => void;
}

export function ConfigField({
	field,
	value,
	canWrite,
	onChange,
	onReset,
}: ConfigFieldProps) {
	// For number fields, track the string representation to allow empty inputs
	const [inputValue, setInputValue] = useState(() =>
		field.type === "number" ? String(value) : value,
	);

	// Update when the value prop changes from external sources (save/reset)
	useEffect(() => {
		if (field.type === "number") {
			setInputValue(String(value));
		} else {
			setInputValue(value);
		}
	}, [value, field.type]);

	// Get the actual value to compare and save
	const getCurrentValue = useCallback(() => {
		if (field.type === "number") {
			const num = Number(inputValue);
			return Number.isNaN(num) ? value : num;
		}
		return inputValue;
	}, [field.type, inputValue, value]);

	// Check if current value differs from default
	const currentValue = getCurrentValue();
	const isDifferentFromDefault = currentValue !== field.defaultValue;

	const handleChange = useCallback(
		(newValue: unknown) => {
			setInputValue(newValue);
			// Notify parent of value change
			if (field.type === "number") {
				const num = Number(newValue);
				if (!Number.isNaN(num)) {
					onChange(num);
				}
			} else {
				onChange(newValue);
			}
		},
		[field.type, onChange],
	);

	const handleReset = useCallback(() => {
		onReset();
	}, [onReset]);

	const renderInput = () => {
		switch (field.type) {
			case "boolean":
				return (
					<div className="flex items-center gap-2">
						<Checkbox
							id={field.key}
							checked={inputValue as boolean}
							onCheckedChange={handleChange}
							disabled={!canWrite}
						/>
						<label
							htmlFor={field.key}
							className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
						>
							{field.label}
						</label>
					</div>
				);

			case "number":
				return (
					<Input
						type="number"
						value={inputValue as string}
						onChange={(e) => handleChange(e.target.value)}
						placeholder={field.placeholder}
						min={field.min}
						max={field.max}
						step={field.step}
						disabled={!canWrite}
					/>
				);

			case "select":
				return (
					<Select
						value={String(inputValue)}
						onValueChange={handleChange}
						disabled={!canWrite}
					>
						<SelectTrigger>
							<SelectValue placeholder={field.placeholder || "Select..."} />
						</SelectTrigger>
						<SelectContent>
							{field.options?.map((option) => (
								<SelectItem key={option.value} value={option.value}>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				);

			case "textarea":
				return (
					<Textarea
						value={inputValue as string}
						onChange={(e) => handleChange(e.target.value)}
						placeholder={field.placeholder}
						disabled={!canWrite}
						rows={4}
					/>
				);

			case "secret":
				return (
					<Input
						type="password"
						value={inputValue as string}
						onChange={(e) => handleChange(e.target.value)}
						placeholder={field.placeholder}
						disabled={!canWrite}
					/>
				);

			case "color":
				return (
					<ColorPicker
						value={inputValue as string}
						onChange={handleChange}
						disabled={!canWrite}
					/>
				);

			case "svg":
				return (
					<SvgUpload
						value={inputValue as string}
						onChange={handleChange}
						disabled={!canWrite}
					/>
				);

			default:
				return (
					<Input
						type="text"
						value={inputValue as string}
						onChange={(e) => handleChange(e.target.value)}
						placeholder={field.placeholder}
						disabled={!canWrite}
					/>
				);
		}
	};

	// For boolean fields, we render differently
	if (field.type === "boolean") {
		return (
			<div className="flex items-center justify-between gap-4">
				<div className="flex-1">
					{renderInput()}
					{field.description && (
						<FieldDescription className="mt-1.5">
							{field.description}
						</FieldDescription>
					)}
				</div>
				{canWrite && isDifferentFromDefault && (
					<Button
						size="sm"
						variant="ghost"
						onClick={handleReset}
						title="Reset to default"
					>
						<RotateCcwIcon className="h-4 w-4" />
					</Button>
				)}
			</div>
		);
	}

	return (
		<Field>
			<FieldLabel>{field.label}</FieldLabel>
			{field.description && (
				<FieldDescription>{field.description}</FieldDescription>
			)}
			<div className="flex items-center gap-2 mt-2">
				<div className="flex-1">{renderInput()}</div>
				{canWrite && isDifferentFromDefault && (
					<Button
						size="sm"
						variant="ghost"
						onClick={handleReset}
						title="Reset to default"
					>
						<RotateCcwIcon className="h-4 w-4" />
					</Button>
				)}
			</div>
		</Field>
	);
}
