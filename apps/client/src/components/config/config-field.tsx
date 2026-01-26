import { ImageIcon, RotateCcwIcon, Upload } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
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
import { cn } from "@/lib/utils";

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
	darkPreview?: boolean;
}

interface ConfigFieldProps {
	field: ConfigFieldDef;
	value: unknown;
	canWrite: boolean;
	isSaving: boolean;
	onChange: (value: unknown) => void;
	onReset: () => void;
}

export function ConfigField({
	field,
	value,
	canWrite,
	isSaving,
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
							disabled={!canWrite || isSaving}
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
						disabled={!canWrite || isSaving}
					/>
				);

			case "select":
				return (
					<Select
						value={String(inputValue)}
						onValueChange={handleChange}
						disabled={!canWrite || isSaving}
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
						disabled={!canWrite || isSaving}
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
						disabled={!canWrite || isSaving}
					/>
				);

			case "svg-upload":
				// Handled separately below
				return null;

			default:
				return (
					<Input
						type="text"
						value={inputValue as string}
						onChange={(e) => handleChange(e.target.value)}
						placeholder={field.placeholder}
						disabled={!canWrite || isSaving}
					/>
				);
		}
	};

	// For svg-upload fields, we render a special file upload UI
	if (field.type === "svg-upload") {
		return (
			<SvgUploadField
				field={field}
				value={inputValue as string}
				defaultValue={field.defaultValue as string}
				canWrite={canWrite}
				isSaving={isSaving}
				isDifferentFromDefault={isDifferentFromDefault}
				onChange={handleChange}
				onReset={handleReset}
			/>
		);
	}

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
						disabled={isSaving}
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
						disabled={isSaving}
						title="Reset to default"
					>
						<RotateCcwIcon className="h-4 w-4" />
					</Button>
				)}
			</div>
		</Field>
	);
}

// SVG Upload Field Component
interface SvgUploadFieldProps {
	field: ConfigFieldDef;
	value: string;
	defaultValue: string;
	canWrite: boolean;
	isSaving: boolean;
	isDifferentFromDefault: boolean;
	onChange: (value: string) => void;
	onReset: () => void;
}

function SvgUploadField({
	field,
	value,
	defaultValue,
	canWrite,
	isSaving,
	isDifferentFromDefault,
	onChange,
	onReset,
}: SvgUploadFieldProps) {
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [dragOver, setDragOver] = useState(false);

	const handleFileSelect = useCallback(
		(file: File) => {
			if (!file.name.endsWith(".svg")) {
				toast.error("Please upload an SVG file");
				return;
			}

			if (file.size > 500 * 1024) {
				toast.error("File size must be less than 500KB");
				return;
			}

			const reader = new FileReader();
			reader.onload = (e) => {
				const content = e.target?.result as string;
				onChange(content);
			};
			reader.onerror = () => {
				toast.error("Failed to read file");
			};
			reader.readAsText(file);
		},
		[onChange],
	);

	const handleDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault();
			setDragOver(false);

			const file = e.dataTransfer.files[0];
			if (file) {
				handleFileSelect(file);
			}
		},
		[handleFileSelect],
	);

	const handleDragOver = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		setDragOver(true);
	}, []);

	const handleDragLeave = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		setDragOver(false);
	}, []);

	const handleInputChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const file = e.target.files?.[0];
			if (file) {
				handleFileSelect(file);
			}
			// Reset input so same file can be re-selected
			e.target.value = "";
		},
		[handleFileSelect],
	);

	// Create a data URL from SVG content for preview
	const svgDataUrl = value
		? `data:image/svg+xml;base64,${btoa(value)}`
		: undefined;

	const defaultDataUrl = defaultValue
		? `data:image/svg+xml;base64,${btoa(defaultValue)}`
		: undefined;

	return (
		<Field>
			<FieldLabel className="flex items-center gap-2">
				<ImageIcon className="h-4 w-4" />
				{field.label}
				{isDifferentFromDefault && (
					<span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
						Custom
					</span>
				)}
			</FieldLabel>
			{field.description && (
				<FieldDescription>{field.description}</FieldDescription>
			)}

			{/* Preview / Drop Zone */}
			{/* biome-ignore lint/a11y/noStaticElementInteractions: drag-drop zone requires event handlers */}
			<div
				role={canWrite ? "button" : undefined}
				tabIndex={canWrite ? 0 : undefined}
				className={cn(
					"relative border rounded-lg p-4 flex items-center justify-center min-h-[100px] mt-2",
					field.darkPreview ? "bg-zinc-900" : "bg-zinc-50",
					dragOver && "border-primary border-2",
					canWrite && "cursor-pointer hover:border-muted-foreground/50",
				)}
				onDrop={canWrite ? handleDrop : undefined}
				onDragOver={canWrite ? handleDragOver : undefined}
				onDragLeave={canWrite ? handleDragLeave : undefined}
				onClick={canWrite ? () => fileInputRef.current?.click() : undefined}
				onKeyDown={
					canWrite
						? (e) => {
								if (e.key === "Enter" || e.key === " ") {
									fileInputRef.current?.click();
								}
							}
						: undefined
				}
			>
				{svgDataUrl ? (
					<img
						src={svgDataUrl}
						alt={field.label}
						className="max-h-[60px] max-w-full object-contain"
					/>
				) : (
					<div className="text-muted-foreground text-sm flex flex-col items-center gap-2">
						<Upload className="h-6 w-6" />
						<span>
							{canWrite ? "Click or drag SVG file here" : "No logo set"}
						</span>
					</div>
				)}
				{dragOver && (
					<div className="absolute inset-0 bg-primary/10 rounded-lg flex items-center justify-center">
						<span className="text-primary font-medium">Drop SVG file here</span>
					</div>
				)}
			</div>

			{/* Hidden file input */}
			<input
				ref={fileInputRef}
				type="file"
				accept=".svg"
				className="hidden"
				onChange={handleInputChange}
			/>

			{/* Actions */}
			{canWrite && (
				<div className="flex gap-2 mt-2">
					<Button
						variant="outline"
						size="sm"
						onClick={() => fileInputRef.current?.click()}
						disabled={isSaving}
					>
						<Upload className="h-4 w-4 mr-2" />
						Upload SVG
					</Button>
					{isDifferentFromDefault && (
						<Button
							variant="outline"
							size="sm"
							onClick={onReset}
							disabled={isSaving}
						>
							<RotateCcwIcon className="h-4 w-4 mr-2" />
							Reset to Default
						</Button>
					)}
				</div>
			)}

			{/* Default preview when custom is set */}
			{isDifferentFromDefault && defaultDataUrl && (
				<div className="mt-3 pt-3 border-t">
					<p className="text-xs text-muted-foreground mb-2">Default:</p>
					<div
						className={cn(
							"border rounded p-2 flex items-center justify-center",
							field.darkPreview ? "bg-zinc-900" : "bg-zinc-50",
						)}
					>
						<img
							src={defaultDataUrl}
							alt={`Default ${field.label}`}
							className="max-h-[30px] max-w-full object-contain opacity-50"
						/>
					</div>
				</div>
			)}
		</Field>
	);
}
