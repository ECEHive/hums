import {
	ChevronDownIcon,
	ChevronUpIcon,
	GripVerticalIcon,
	PlusIcon,
	Trash2Icon,
} from "lucide-react";
import { useCallback, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
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

// Field types supported by the ticket system
export const FIELD_TYPES = [
	{ value: "text", label: "Text (Single Line)" },
	{ value: "textarea", label: "Text (Multi-line)" },
	{ value: "number", label: "Number" },
	{ value: "email", label: "Email" },
	{ value: "url", label: "URL" },
	{ value: "tel", label: "Phone Number" },
	{ value: "date", label: "Date" },
	{ value: "datetime", label: "Date & Time" },
	{ value: "time", label: "Time" },
	{ value: "select", label: "Dropdown Select" },
	{ value: "radio", label: "Radio Buttons" },
	{ value: "checkbox", label: "Checkbox (Yes/No)" },
	{ value: "checkboxGroup", label: "Checkbox Group (Multiple)" },
] as const;

export type FieldType = (typeof FIELD_TYPES)[number]["value"];

export interface FieldOption {
	value: string;
	label: string;
}

export interface TicketField {
	id: string;
	label: string;
	type: FieldType;
	required: boolean;
	description?: string;
	placeholder?: string;
	defaultValue?: string | number | boolean | string[];
	// Text field options
	minLength?: number;
	maxLength?: number;
	pattern?: string;
	patternMessage?: string;
	// Textarea options
	rows?: number;
	// Number field options
	min?: number;
	max?: number;
	step?: number;
	integer?: boolean;
	// Date field options
	minDate?: string;
	maxDate?: string;
	// Select/Radio/CheckboxGroup options
	options?: FieldOption[];
	// Checkbox options
	checkboxLabel?: string;
	// CheckboxGroup options
	minSelections?: number;
	maxSelections?: number;
}

export interface FieldBuilderProps {
	fields: TicketField[];
	onChange: (fields: TicketField[]) => void;
	errors?: Record<string, string[]>;
}

// Generate a unique field ID
function generateFieldId(): string {
	return `field_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

// Create a new empty field
function createEmptyField(type: FieldType = "text"): TicketField {
	const baseField: TicketField = {
		id: generateFieldId(),
		label: "",
		type,
		required: false,
	};

	// Add type-specific defaults
	if (type === "select" || type === "radio" || type === "checkboxGroup") {
		baseField.options = [{ value: "", label: "" }];
	}

	if (type === "textarea") {
		baseField.rows = 4;
	}

	if (type === "number") {
		baseField.integer = false;
	}

	return baseField;
}

export function FieldBuilder({ fields, onChange, errors }: FieldBuilderProps) {
	const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set());

	const toggleExpanded = useCallback((fieldId: string) => {
		setExpandedFields((prev) => {
			const next = new Set(prev);
			if (next.has(fieldId)) {
				next.delete(fieldId);
			} else {
				next.add(fieldId);
			}
			return next;
		});
	}, []);

	const addField = useCallback(() => {
		const newField = createEmptyField();
		onChange([...fields, newField]);
		setExpandedFields((prev) => new Set(prev).add(newField.id));
	}, [fields, onChange]);

	const removeField = useCallback(
		(index: number) => {
			const newFields = [...fields];
			newFields.splice(index, 1);
			onChange(newFields);
		},
		[fields, onChange],
	);

	const updateField = useCallback(
		(index: number, updates: Partial<TicketField>) => {
			const newFields = [...fields];
			newFields[index] = { ...newFields[index], ...updates };
			onChange(newFields);
		},
		[fields, onChange],
	);

	const moveField = useCallback(
		(fromIndex: number, direction: "up" | "down") => {
			const toIndex = direction === "up" ? fromIndex - 1 : fromIndex + 1;
			if (toIndex < 0 || toIndex >= fields.length) return;

			const newFields = [...fields];
			const [removed] = newFields.splice(fromIndex, 1);
			newFields.splice(toIndex, 0, removed);
			onChange(newFields);
		},
		[fields, onChange],
	);

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h3 className="text-sm font-medium">Form Fields</h3>
				<Button type="button" variant="outline" size="sm" onClick={addField}>
					<PlusIcon className="h-4 w-4 mr-2" />
					Add Field
				</Button>
			</div>

			{fields.length === 0 ? (
				<Card className="border-dashed">
					<CardContent className="py-8 text-center">
						<p className="text-muted-foreground mb-4">
							No fields defined yet. Add fields to create your form.
						</p>
						<Button type="button" variant="outline" onClick={addField}>
							<PlusIcon className="h-4 w-4 mr-2" />
							Add First Field
						</Button>
					</CardContent>
				</Card>
			) : (
				<div className="space-y-2">
					{fields.map((field, index) => (
						<FieldEditor
							key={field.id}
							field={field}
							index={index}
							totalFields={fields.length}
							isExpanded={expandedFields.has(field.id)}
							onToggleExpanded={() => toggleExpanded(field.id)}
							onUpdate={(updates) => updateField(index, updates)}
							onRemove={() => removeField(index)}
							onMoveUp={() => moveField(index, "up")}
							onMoveDown={() => moveField(index, "down")}
							errors={errors?.[field.id]}
						/>
					))}
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={addField}
						className="w-full"
					>
						<PlusIcon className="h-4 w-4 mr-2" />
						New Field
					</Button>
				</div>
			)}
		</div>
	);
}

interface FieldEditorProps {
	field: TicketField;
	index: number;
	totalFields: number;
	isExpanded: boolean;
	onToggleExpanded: () => void;
	onUpdate: (updates: Partial<TicketField>) => void;
	onRemove: () => void;
	onMoveUp: () => void;
	onMoveDown: () => void;
	errors?: string[];
}

function FieldEditor({
	field,
	index,
	totalFields,
	isExpanded,
	onToggleExpanded,
	onUpdate,
	onRemove,
	onMoveUp,
	onMoveDown,
	errors,
}: FieldEditorProps) {
	const fieldTypeLabel =
		FIELD_TYPES.find((t) => t.value === field.type)?.label ?? field.type;

	const handleTypeChange = (newType: FieldType) => {
		const updates: Partial<TicketField> = { type: newType };

		// Reset type-specific fields when type changes
		if (
			newType === "select" ||
			newType === "radio" ||
			newType === "checkboxGroup"
		) {
			if (!field.options || field.options.length === 0) {
				updates.options = [{ value: "", label: "" }];
			}
		}

		if (newType === "textarea" && !field.rows) {
			updates.rows = 4;
		}

		if (newType === "number") {
			updates.integer = field.integer ?? false;
		}

		// Clear irrelevant fields
		if (newType !== "textarea") {
			updates.rows = undefined;
		}
		if (newType !== "text" && newType !== "tel") {
			updates.pattern = undefined;
			updates.patternMessage = undefined;
		}
		if (newType !== "number") {
			updates.min = undefined;
			updates.max = undefined;
			updates.step = undefined;
			updates.integer = undefined;
		}
		if (newType !== "date" && newType !== "datetime") {
			updates.minDate = undefined;
			updates.maxDate = undefined;
		}
		if (
			newType !== "select" &&
			newType !== "radio" &&
			newType !== "checkboxGroup"
		) {
			updates.options = undefined;
		}
		if (newType !== "checkbox") {
			updates.checkboxLabel = undefined;
		}
		if (newType !== "checkboxGroup") {
			updates.minSelections = undefined;
			updates.maxSelections = undefined;
		}

		onUpdate(updates);
	};

	return (
		<Card className={cn(errors && errors.length > 0 && "border-destructive")}>
			<Collapsible open={isExpanded} onOpenChange={onToggleExpanded}>
				<CardHeader className="py-2 px-3">
					<div className="flex items-center gap-2">
						<div className="text-muted-foreground cursor-grab">
							<GripVerticalIcon className="h-4 w-4" />
						</div>

						<div className="flex items-center gap-1">
							<Button
								type="button"
								variant="ghost"
								size="icon"
								className="h-6 w-6"
								disabled={index === 0}
								onClick={(e) => {
									e.stopPropagation();
									onMoveUp();
								}}
							>
								<ChevronUpIcon className="h-3 w-3" />
							</Button>
							<Button
								type="button"
								variant="ghost"
								size="icon"
								className="h-6 w-6"
								disabled={index === totalFields - 1}
								onClick={(e) => {
									e.stopPropagation();
									onMoveDown();
								}}
							>
								<ChevronDownIcon className="h-3 w-3" />
							</Button>
						</div>

						<CollapsibleTrigger asChild>
							<button
								type="button"
								className="flex-1 flex items-center gap-2 text-left hover:bg-muted/50 rounded px-2 py-1 -mx-2"
							>
								<div className="flex-1 min-w-0">
									<div className="flex items-center gap-2">
										<span className="font-medium truncate">
											{field.label || "Untitled Field"}
										</span>
										<Badge variant="outline" className="text-xs">
											{fieldTypeLabel}
										</Badge>
										{field.required && (
											<Badge variant="secondary" className="text-xs">
												Required
											</Badge>
										)}
									</div>
								</div>
								{isExpanded ? (
									<ChevronUpIcon className="h-4 w-4 text-muted-foreground" />
								) : (
									<ChevronDownIcon className="h-4 w-4 text-muted-foreground" />
								)}
							</button>
						</CollapsibleTrigger>

						<Button
							type="button"
							variant="ghost"
							size="icon"
							className="h-8 w-8 text-destructive hover:text-destructive"
							onClick={(e) => {
								e.stopPropagation();
								onRemove();
							}}
						>
							<Trash2Icon className="h-4 w-4" />
						</Button>
					</div>
				</CardHeader>

				<CollapsibleContent>
					<CardContent className="pt-0 pb-4 px-4 space-y-4">
						{errors && errors.length > 0 && (
							<div className="text-sm text-destructive">
								{errors.map((error, i) => (
									<p key={i}>{error}</p>
								))}
							</div>
						)}

						{/* Basic Settings */}
						<div className="grid gap-4 sm:grid-cols-2">
							<Field>
								<FieldLabel>Field Type</FieldLabel>
								<Select value={field.type} onValueChange={handleTypeChange}>
									<SelectTrigger>
										<SelectValue placeholder="Select type" />
									</SelectTrigger>
									<SelectContent>
										{FIELD_TYPES.map((type) => (
											<SelectItem key={type.value} value={type.value}>
												{type.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</Field>
						</div>

						<Field>
							<FieldLabel>Label</FieldLabel>
							<Input
								value={field.label}
								onChange={(e) => onUpdate({ label: e.target.value })}
								placeholder="Field label shown to users"
							/>
						</Field>

						<Field>
							<FieldLabel>Description / Help Text</FieldLabel>
							<Textarea
								value={field.description ?? ""}
								onChange={(e) =>
									onUpdate({ description: e.target.value || undefined })
								}
								placeholder="Optional help text shown below the field"
								rows={2}
							/>
						</Field>

						<Field>
							<FieldLabel>Placeholder</FieldLabel>
							<Input
								value={field.placeholder ?? ""}
								onChange={(e) =>
									onUpdate({ placeholder: e.target.value || undefined })
								}
								placeholder="Placeholder text shown in the input"
							/>
						</Field>

						<div className="flex items-center gap-3 p-3 border rounded-lg">
							<Checkbox
								id={`${field.id}-required`}
								checked={field.required}
								onCheckedChange={(checked) => onUpdate({ required: !!checked })}
							/>
							<label
								htmlFor={`${field.id}-required`}
								className="text-sm font-medium"
							>
								Required field
							</label>
						</div>

						{/* Type-specific settings */}
						{(field.type === "text" || field.type === "textarea") && (
							<TextFieldSettings field={field} onUpdate={onUpdate} />
						)}

						{field.type === "number" && (
							<NumberFieldSettings field={field} onUpdate={onUpdate} />
						)}

						{(field.type === "date" || field.type === "datetime") && (
							<DateFieldSettings field={field} onUpdate={onUpdate} />
						)}

						{(field.type === "select" ||
							field.type === "radio" ||
							field.type === "checkboxGroup") && (
							<OptionsFieldSettings field={field} onUpdate={onUpdate} />
						)}

						{field.type === "checkbox" && (
							<CheckboxFieldSettings field={field} onUpdate={onUpdate} />
						)}

						{field.type === "checkboxGroup" && (
							<CheckboxGroupFieldSettings field={field} onUpdate={onUpdate} />
						)}

						{(field.type === "text" || field.type === "tel") && (
							<PatternFieldSettings field={field} onUpdate={onUpdate} />
						)}
					</CardContent>
				</CollapsibleContent>
			</Collapsible>
		</Card>
	);
}

// Text/Textarea field settings
function TextFieldSettings({
	field,
	onUpdate,
}: {
	field: TicketField;
	onUpdate: (updates: Partial<TicketField>) => void;
}) {
	return (
		<div className="space-y-4 pt-2 border-t">
			<h4 className="text-sm font-medium">Text Options</h4>
			<div className="grid gap-4 sm:grid-cols-2">
				<Field>
					<FieldLabel>Min Length</FieldLabel>
					<Input
						type="number"
						min={0}
						value={field.minLength ?? ""}
						onChange={(e) =>
							onUpdate({
								minLength: e.target.value ? Number(e.target.value) : undefined,
							})
						}
						placeholder="No minimum"
					/>
				</Field>
				<Field>
					<FieldLabel>Max Length</FieldLabel>
					<Input
						type="number"
						min={1}
						value={field.maxLength ?? ""}
						onChange={(e) =>
							onUpdate({
								maxLength: e.target.value ? Number(e.target.value) : undefined,
							})
						}
						placeholder="No maximum"
					/>
				</Field>
			</div>
			{field.type === "textarea" && (
				<Field>
					<FieldLabel>Rows</FieldLabel>
					<Input
						type="number"
						min={1}
						max={20}
						value={field.rows ?? 4}
						onChange={(e) => onUpdate({ rows: Number(e.target.value) || 4 })}
					/>
					<FieldDescription>Number of visible rows (1-20)</FieldDescription>
				</Field>
			)}
		</div>
	);
}

// Number field settings
function NumberFieldSettings({
	field,
	onUpdate,
}: {
	field: TicketField;
	onUpdate: (updates: Partial<TicketField>) => void;
}) {
	return (
		<div className="space-y-4 pt-2 border-t">
			<h4 className="text-sm font-medium">Number Options</h4>
			<div className="grid gap-4 sm:grid-cols-3">
				<Field>
					<FieldLabel>Minimum</FieldLabel>
					<Input
						type="number"
						value={field.min ?? ""}
						onChange={(e) =>
							onUpdate({
								min: e.target.value ? Number(e.target.value) : undefined,
							})
						}
						placeholder="No minimum"
					/>
				</Field>
				<Field>
					<FieldLabel>Maximum</FieldLabel>
					<Input
						type="number"
						value={field.max ?? ""}
						onChange={(e) =>
							onUpdate({
								max: e.target.value ? Number(e.target.value) : undefined,
							})
						}
						placeholder="No maximum"
					/>
				</Field>
				<Field>
					<FieldLabel>Step</FieldLabel>
					<Input
						type="number"
						value={field.step ?? ""}
						onChange={(e) =>
							onUpdate({
								step: e.target.value ? Number(e.target.value) : undefined,
							})
						}
						placeholder="1"
					/>
				</Field>
			</div>
			<div className="flex items-center gap-3 p-3 border rounded-lg">
				<Checkbox
					id={`${field.id}-integer`}
					checked={field.integer ?? false}
					onCheckedChange={(checked) => onUpdate({ integer: !!checked })}
				/>
				<label htmlFor={`${field.id}-integer`} className="text-sm font-medium">
					Integer only (no decimals)
				</label>
			</div>
		</div>
	);
}

// Date/Datetime field settings
function DateFieldSettings({
	field,
	onUpdate,
}: {
	field: TicketField;
	onUpdate: (updates: Partial<TicketField>) => void;
}) {
	return (
		<div className="space-y-4 pt-2 border-t">
			<h4 className="text-sm font-medium">Date Options</h4>
			<div className="grid gap-4 sm:grid-cols-2">
				<Field>
					<FieldLabel>Minimum Date</FieldLabel>
					<Input
						type={field.type === "datetime" ? "datetime-local" : "date"}
						value={field.minDate ?? ""}
						onChange={(e) => onUpdate({ minDate: e.target.value || undefined })}
					/>
					<FieldDescription>Leave empty for no minimum</FieldDescription>
				</Field>
				<Field>
					<FieldLabel>Maximum Date</FieldLabel>
					<Input
						type={field.type === "datetime" ? "datetime-local" : "date"}
						value={field.maxDate ?? ""}
						onChange={(e) => onUpdate({ maxDate: e.target.value || undefined })}
					/>
					<FieldDescription>Leave empty for no maximum</FieldDescription>
				</Field>
			</div>
		</div>
	);
}

// Select/Radio/CheckboxGroup options
function OptionsFieldSettings({
	field,
	onUpdate,
}: {
	field: TicketField;
	onUpdate: (updates: Partial<TicketField>) => void;
}) {
	const options = field.options ?? [];

	const addOption = () => {
		onUpdate({ options: [...options, { value: "", label: "" }] });
	};

	const updateOption = (index: number, updates: Partial<FieldOption>) => {
		const newOptions = [...options];
		newOptions[index] = { ...newOptions[index], ...updates };
		onUpdate({ options: newOptions });
	};

	const removeOption = (index: number) => {
		const newOptions = [...options];
		newOptions.splice(index, 1);
		onUpdate({ options: newOptions });
	};

	return (
		<div className="space-y-4 pt-2 border-t">
			<div className="flex items-center justify-between">
				<h4 className="text-sm font-medium">Options</h4>
				<Button type="button" variant="outline" size="sm" onClick={addOption}>
					<PlusIcon className="h-4 w-4 mr-1" />
					Add Option
				</Button>
			</div>

			{options.length === 0 ? (
				<p className="text-sm text-muted-foreground">No options defined</p>
			) : (
				<div className="space-y-2">
					{options.map((option, index) => (
						<div key={index} className="flex items-center gap-2">
							<Input
								value={option.value}
								onChange={(e) => updateOption(index, { value: e.target.value })}
								placeholder="Value"
								className="flex-1"
							/>
							<Input
								value={option.label}
								onChange={(e) => updateOption(index, { label: e.target.value })}
								placeholder="Label"
								className="flex-1"
							/>
							<Button
								type="button"
								variant="ghost"
								size="icon"
								className="h-8 w-8"
								disabled={options.length === 1}
								onClick={() => removeOption(index)}
							>
								<Trash2Icon className="h-4 w-4" />
							</Button>
						</div>
					))}
				</div>
			)}
		</div>
	);
}

// Single checkbox settings
function CheckboxFieldSettings({
	field,
	onUpdate,
}: {
	field: TicketField;
	onUpdate: (updates: Partial<TicketField>) => void;
}) {
	return (
		<div className="space-y-4 pt-2 border-t">
			<h4 className="text-sm font-medium">Checkbox Options</h4>
			<Field>
				<FieldLabel>Checkbox Label</FieldLabel>
				<Input
					value={field.checkboxLabel ?? ""}
					onChange={(e) =>
						onUpdate({ checkboxLabel: e.target.value || undefined })
					}
					placeholder="Text shown next to the checkbox"
				/>
				<FieldDescription>
					Optional text shown next to the checkbox (uses field label if not set)
				</FieldDescription>
			</Field>
		</div>
	);
}

// Checkbox group settings
function CheckboxGroupFieldSettings({
	field,
	onUpdate,
}: {
	field: TicketField;
	onUpdate: (updates: Partial<TicketField>) => void;
}) {
	return (
		<div className="space-y-4 pt-2 border-t">
			<h4 className="text-sm font-medium">Selection Limits</h4>
			<div className="grid gap-4 sm:grid-cols-2">
				<Field>
					<FieldLabel>Min Selections</FieldLabel>
					<Input
						type="number"
						min={0}
						value={field.minSelections ?? ""}
						onChange={(e) =>
							onUpdate({
								minSelections: e.target.value
									? Number(e.target.value)
									: undefined,
							})
						}
						placeholder="No minimum"
					/>
				</Field>
				<Field>
					<FieldLabel>Max Selections</FieldLabel>
					<Input
						type="number"
						min={1}
						value={field.maxSelections ?? ""}
						onChange={(e) =>
							onUpdate({
								maxSelections: e.target.value
									? Number(e.target.value)
									: undefined,
							})
						}
						placeholder="No maximum"
					/>
				</Field>
			</div>
		</div>
	);
}

// Pattern validation settings (for text and tel fields)
function PatternFieldSettings({
	field,
	onUpdate,
}: {
	field: TicketField;
	onUpdate: (updates: Partial<TicketField>) => void;
}) {
	return (
		<div className="space-y-4 pt-2 border-t">
			<h4 className="text-sm font-medium">Pattern Validation</h4>
			<Field>
				<FieldLabel>Regex Pattern</FieldLabel>
				<Input
					value={field.pattern ?? ""}
					onChange={(e) => onUpdate({ pattern: e.target.value || undefined })}
					placeholder="^[A-Za-z]+$"
				/>
				<FieldDescription>
					Regular expression pattern for validation (optional)
				</FieldDescription>
			</Field>
			<Field>
				<FieldLabel>Pattern Error Message</FieldLabel>
				<Input
					value={field.patternMessage ?? ""}
					onChange={(e) =>
						onUpdate({ patternMessage: e.target.value || undefined })
					}
					placeholder="Invalid format"
				/>
				<FieldDescription>
					Custom error message shown when pattern validation fails
				</FieldDescription>
			</Field>
		</div>
	);
}
