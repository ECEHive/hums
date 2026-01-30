import { useForm, useStore } from "@tanstack/react-form";
import { Loader2Icon } from "lucide-react";
import { useCallback, useMemo } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { TicketField } from "./field-builder";

interface DynamicTicketFormProps {
	fields: TicketField[];
	onSubmit: (data: Record<string, unknown>) => void;
	isSubmitting?: boolean;
	submitButtonText?: string;
}

// Build Zod schema from field definitions (client-side version)
function buildZodSchema(fields: TicketField[]): z.ZodSchema {
	const shape: Record<string, z.ZodTypeAny> = {};

	for (const field of fields) {
		let fieldSchema: z.ZodTypeAny;

		switch (field.type) {
			case "text": {
				let textSchema = z.string();
				if (field.minLength !== undefined) {
					textSchema = textSchema.min(
						field.minLength,
						`Must be at least ${field.minLength} characters`,
					);
				}
				if (field.maxLength !== undefined) {
					textSchema = textSchema.max(
						field.maxLength,
						`Must be at most ${field.maxLength} characters`,
					);
				}
				if (field.pattern) {
					textSchema = textSchema.regex(
						new RegExp(field.pattern),
						field.patternMessage ?? "Invalid format",
					);
				}
				fieldSchema = textSchema;
				break;
			}

			case "textarea": {
				let textareaSchema = z.string();
				if (field.minLength !== undefined) {
					textareaSchema = textareaSchema.min(
						field.minLength,
						`Must be at least ${field.minLength} characters`,
					);
				}
				if (field.maxLength !== undefined) {
					textareaSchema = textareaSchema.max(
						field.maxLength,
						`Must be at most ${field.maxLength} characters`,
					);
				}
				fieldSchema = textareaSchema;
				break;
			}

			case "number": {
				let numberSchema = z.coerce.number();
				if (field.integer) {
					numberSchema = numberSchema.int("Must be a whole number");
				}
				if (field.min !== undefined) {
					numberSchema = numberSchema.min(
						field.min,
						`Must be at least ${field.min}`,
					);
				}
				if (field.max !== undefined) {
					numberSchema = numberSchema.max(
						field.max,
						`Must be at most ${field.max}`,
					);
				}
				fieldSchema = numberSchema;
				break;
			}

			case "email":
				fieldSchema = z.string().email("Must be a valid email address");
				break;

			case "url":
				fieldSchema = z.string().url("Must be a valid URL");
				break;

			case "tel": {
				let telSchema = z.string();
				if (field.pattern) {
					telSchema = telSchema.regex(
						new RegExp(field.pattern),
						field.patternMessage ?? "Invalid phone number format",
					);
				}
				fieldSchema = telSchema;
				break;
			}

			case "date":
				fieldSchema = z.string();
				break;

			case "datetime":
				fieldSchema = z.string();
				break;

			case "time":
				fieldSchema = z.string();
				break;

			case "select":
			case "radio": {
				const validValues = (field.options ?? []).map((o) => o.value);
				fieldSchema = z
					.string()
					.refine(
						(val) => validValues.includes(val),
						`Must be one of the available options`,
					);
				break;
			}

			case "checkbox":
				fieldSchema = z.boolean();
				break;

			case "checkboxGroup": {
				const validValues = (field.options ?? []).map((o) => o.value);
				let arraySchema = z.array(
					z.string().refine((val) => validValues.includes(val)),
				);
				if (field.minSelections !== undefined) {
					arraySchema = arraySchema.min(
						field.minSelections,
						`Select at least ${field.minSelections} option(s)`,
					);
				}
				if (field.maxSelections !== undefined) {
					arraySchema = arraySchema.max(
						field.maxSelections,
						`Select at most ${field.maxSelections} option(s)`,
					);
				}
				fieldSchema = arraySchema;
				break;
			}

			default:
				fieldSchema = z.unknown();
		}

		// Handle required vs optional
		if (!field.required) {
			if (
				[
					"text",
					"textarea",
					"email",
					"url",
					"tel",
					"date",
					"datetime",
					"time",
					"select",
					"radio",
				].includes(field.type)
			) {
				fieldSchema = z.union([fieldSchema, z.literal("")]).optional();
			} else if (field.type === "checkbox") {
				fieldSchema = fieldSchema.optional();
			} else if (field.type === "checkboxGroup") {
				fieldSchema = fieldSchema.optional();
			} else {
				fieldSchema = fieldSchema.optional();
			}
		} else {
			if (
				["text", "textarea", "email", "url", "tel", "select", "radio"].includes(
					field.type,
				)
			) {
				fieldSchema = z
					.string()
					.min(1, `${field.label} is required`)
					.and(fieldSchema as z.ZodString);
			}
		}

		shape[field.id] = fieldSchema;
	}

	return z.object(shape);
}

// Get default values for fields
function getDefaultValues(fields: TicketField[]): Record<string, unknown> {
	const defaults: Record<string, unknown> = {};

	for (const field of fields) {
		if (field.defaultValue !== undefined) {
			defaults[field.id] = field.defaultValue;
		} else {
			switch (field.type) {
				case "text":
				case "textarea":
				case "email":
				case "url":
				case "tel":
				case "date":
				case "datetime":
				case "time":
				case "select":
				case "radio":
					defaults[field.id] = "";
					break;
				case "number":
					defaults[field.id] = field.min ?? 0;
					break;
				case "checkbox":
					defaults[field.id] = false;
					break;
				case "checkboxGroup":
					defaults[field.id] = [];
					break;
			}
		}
	}

	return defaults;
}

export function DynamicTicketForm({
	fields,
	onSubmit,
	isSubmitting = false,
	submitButtonText = "Submit",
}: DynamicTicketFormProps) {
	const schema = useMemo(() => buildZodSchema(fields), [fields]);
	const defaultValues = useMemo(() => getDefaultValues(fields), [fields]);

	const form = useForm({
		defaultValues,
		validators: {
			onSubmit: schema,
		},
		onSubmit: async ({ value }) => {
			// Clean up empty optional fields
			const cleanedData: Record<string, unknown> = {};
			for (const field of fields) {
				const val = value[field.id];
				if (
					val !== undefined &&
					val !== "" &&
					!(Array.isArray(val) && val.length === 0)
				) {
					cleanedData[field.id] = val;
				} else if (field.required) {
					cleanedData[field.id] = val;
				}
			}
			onSubmit(cleanedData);
		},
	});

	const canSubmit = useStore(form.store, (state) => state.canSubmit);

	if (fields.length === 0) {
		return (
			<div className="text-center py-8 text-muted-foreground">
				This form has no fields configured.
			</div>
		);
	}

	return (
		<form
			className="space-y-4"
			onSubmit={(e) => {
				e.preventDefault();
				form.handleSubmit();
			}}
			noValidate
		>
			{fields.map((field) => (
				<DynamicField key={field.id} field={field} form={form} />
			))}

			<Button
				type="submit"
				className="w-full"
				disabled={isSubmitting || !canSubmit}
			>
				{isSubmitting ? (
					<>
						<Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
						Submitting...
					</>
				) : (
					submitButtonText
				)}
			</Button>
		</form>
	);
}

interface DynamicFieldProps {
	field: TicketField;
	form: ReturnType<typeof useForm>;
}

function DynamicField({ field, form }: DynamicFieldProps) {
	return (
		<form.Field
			name={field.id}
			children={(formField) => {
				const isInvalid =
					formField.state.meta.isTouched && !formField.state.meta.isValid;
				const errors = formField.state.meta.errors;

				return (
					<Field data-invalid={isInvalid}>
						{field.type !== "checkbox" && (
							<FieldLabel htmlFor={field.id}>
								{field.label}
								{field.required && " *"}
							</FieldLabel>
						)}

						{field.description && field.type !== "checkbox" && (
							<FieldDescription>{field.description}</FieldDescription>
						)}

						<FieldInput field={field} formField={formField} />

						{errors.length > 0 && <FieldError>{errors.join(", ")}</FieldError>}
					</Field>
				);
			}}
		/>
	);
}

interface FieldInputProps {
	field: TicketField;
	formField: {
		state: {
			value: unknown;
		};
		handleChange: (value: unknown) => void;
		handleBlur: () => void;
	};
}

function FieldInput({ field, formField }: FieldInputProps) {
	const { state, handleChange, handleBlur } = formField;
	const value = state.value;

	switch (field.type) {
		case "text":
			return (
				<Input
					id={field.id}
					type="text"
					value={String(value ?? "")}
					onChange={(e) => handleChange(e.target.value)}
					onBlur={handleBlur}
					placeholder={field.placeholder}
					maxLength={field.maxLength}
				/>
			);

		case "textarea":
			return (
				<Textarea
					id={field.id}
					value={String(value ?? "")}
					onChange={(e) => handleChange(e.target.value)}
					onBlur={handleBlur}
					placeholder={field.placeholder}
					maxLength={field.maxLength}
					rows={field.rows ?? 4}
				/>
			);

		case "number":
			return (
				<Input
					id={field.id}
					type="number"
					value={value !== undefined && value !== "" ? Number(value) : ""}
					onChange={(e) =>
						handleChange(e.target.value === "" ? "" : Number(e.target.value))
					}
					onBlur={handleBlur}
					placeholder={field.placeholder}
					min={field.min}
					max={field.max}
					step={field.step}
				/>
			);

		case "email":
			return (
				<Input
					id={field.id}
					type="email"
					value={String(value ?? "")}
					onChange={(e) => handleChange(e.target.value)}
					onBlur={handleBlur}
					placeholder={field.placeholder ?? "email@example.com"}
				/>
			);

		case "url":
			return (
				<Input
					id={field.id}
					type="url"
					value={String(value ?? "")}
					onChange={(e) => handleChange(e.target.value)}
					onBlur={handleBlur}
					placeholder={field.placeholder ?? "https://..."}
				/>
			);

		case "tel":
			return (
				<Input
					id={field.id}
					type="tel"
					value={String(value ?? "")}
					onChange={(e) => handleChange(e.target.value)}
					onBlur={handleBlur}
					placeholder={field.placeholder}
				/>
			);

		case "date":
			return (
				<Input
					id={field.id}
					type="date"
					value={String(value ?? "")}
					onChange={(e) => handleChange(e.target.value)}
					onBlur={handleBlur}
					min={field.minDate}
					max={field.maxDate}
				/>
			);

		case "datetime":
			return (
				<Input
					id={field.id}
					type="datetime-local"
					value={String(value ?? "")}
					onChange={(e) => handleChange(e.target.value)}
					onBlur={handleBlur}
					min={field.minDate}
					max={field.maxDate}
				/>
			);

		case "time":
			return (
				<Input
					id={field.id}
					type="time"
					value={String(value ?? "")}
					onChange={(e) => handleChange(e.target.value)}
					onBlur={handleBlur}
				/>
			);

		case "select":
			return (
				<Select value={String(value ?? "")} onValueChange={handleChange}>
					<SelectTrigger>
						<SelectValue
							placeholder={field.placeholder ?? "Select an option"}
						/>
					</SelectTrigger>
					<SelectContent>
						{(field.options ?? []).map((option) => (
							<SelectItem key={option.value} value={option.value}>
								{option.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			);

		case "radio":
			return (
				<RadioGroup
					value={String(value ?? "")}
					onValueChange={handleChange}
					className="space-y-2"
				>
					{(field.options ?? []).map((option) => (
						<div key={option.value} className="flex items-center space-x-2">
							<RadioGroupItem
								value={option.value}
								id={`${field.id}-${option.value}`}
							/>
							<Label htmlFor={`${field.id}-${option.value}`}>
								{option.label}
							</Label>
						</div>
					))}
				</RadioGroup>
			);

		case "checkbox":
			return (
				<div className="flex items-start space-x-3 space-y-0 rounded-lg border p-3">
					<Checkbox
						id={field.id}
						checked={Boolean(value)}
						onCheckedChange={handleChange}
					/>
					<div className="space-y-1 leading-none">
						<Label htmlFor={field.id}>
							{field.checkboxLabel ?? field.label}
							{field.required && " *"}
						</Label>
						{field.description && (
							<p className="text-sm text-muted-foreground">
								{field.description}
							</p>
						)}
					</div>
				</div>
			);

		case "checkboxGroup":
			return (
				<CheckboxGroupInput
					field={field}
					value={Array.isArray(value) ? (value as string[]) : []}
					onChange={handleChange}
				/>
			);

		default:
			return (
				<Input
					id={field.id}
					type="text"
					value={String(value ?? "")}
					onChange={(e) => handleChange(e.target.value)}
					onBlur={handleBlur}
					placeholder={field.placeholder}
				/>
			);
	}
}

interface CheckboxGroupInputProps {
	field: TicketField;
	value: string[];
	onChange: (value: string[]) => void;
}

function CheckboxGroupInput({
	field,
	value,
	onChange,
}: CheckboxGroupInputProps) {
	const handleCheckboxChange = useCallback(
		(optionValue: string, checked: boolean) => {
			if (checked) {
				onChange([...value, optionValue]);
			} else {
				onChange(value.filter((v) => v !== optionValue));
			}
		},
		[value, onChange],
	);

	return (
		<div className="space-y-2">
			{(field.options ?? []).map((option) => (
				<div key={option.value} className="flex items-center space-x-2">
					<Checkbox
						id={`${field.id}-${option.value}`}
						checked={value.includes(option.value)}
						onCheckedChange={(checked) =>
							handleCheckboxChange(option.value, !!checked)
						}
					/>
					<Label htmlFor={`${field.id}-${option.value}`}>{option.label}</Label>
				</div>
			))}
		</div>
	);
}
