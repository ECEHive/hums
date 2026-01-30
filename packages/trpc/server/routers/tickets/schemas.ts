import { z } from "zod";

/**
 * Ticket Status enum
 */
export const TicketStatusEnum = z.enum([
	"pending",
	"in_progress",
	"resolved",
	"closed",
	"cancelled",
]);

export type TicketStatus = z.infer<typeof TicketStatusEnum>;

// ============================================================================
// DYNAMIC FIELD SCHEMA SYSTEM
// ============================================================================

/**
 * Supported field types for ticket forms
 */
export const FieldTypeEnum = z.enum([
	"text", // Single-line text input
	"textarea", // Multi-line text input
	"number", // Numeric input
	"email", // Email input with validation
	"url", // URL input with validation
	"tel", // Phone number input
	"date", // Date picker
	"datetime", // Date and time picker
	"time", // Time picker
	"select", // Dropdown select
	"radio", // Radio button group
	"checkbox", // Single checkbox (boolean)
	"checkboxGroup", // Multiple checkboxes (array)
]);

export type FieldType = z.infer<typeof FieldTypeEnum>;

/**
 * Schema for select/radio/checkbox options
 */
export const FieldOptionSchema = z.object({
	value: z.string().min(1, "Option value is required"),
	label: z.string().min(1, "Option label is required"),
});

export type FieldOption = z.infer<typeof FieldOptionSchema>;

/**
 * Base field schema with common properties
 */
const BaseFieldSchema = z.object({
	// Unique identifier for the field (used as form field name)
	id: z
		.string()
		.min(1, "Field ID is required")
		.regex(
			/^[a-zA-Z][a-zA-Z0-9_]*$/,
			"Field ID must start with a letter and contain only letters, numbers, and underscores",
		),
	// Display label
	label: z.string().min(1, "Field label is required").max(200),
	// Field type
	type: FieldTypeEnum,
	// Whether the field is required
	required: z.boolean().default(false),
	// Help text/description shown below the field
	description: z.string().max(500).optional(),
	// Placeholder text
	placeholder: z.string().max(200).optional(),
	// Default value (type depends on field type)
	defaultValue: z
		.union([z.string(), z.number(), z.boolean(), z.array(z.string())])
		.optional(),
});

/**
 * Text field specific properties
 */
export const TextFieldSchema = BaseFieldSchema.extend({
	type: z.literal("text"),
	minLength: z.number().int().min(0).optional(),
	maxLength: z.number().int().min(1).optional(),
	pattern: z.string().optional(), // Regex pattern for validation
	patternMessage: z.string().optional(), // Custom error message for pattern
});

/**
 * Textarea field specific properties
 */
export const TextareaFieldSchema = BaseFieldSchema.extend({
	type: z.literal("textarea"),
	minLength: z.number().int().min(0).optional(),
	maxLength: z.number().int().min(1).optional(),
	rows: z.number().int().min(1).max(20).optional(),
});

/**
 * Number field specific properties
 */
export const NumberFieldSchema = BaseFieldSchema.extend({
	type: z.literal("number"),
	min: z.number().optional(),
	max: z.number().optional(),
	step: z.number().optional(),
	integer: z.boolean().optional(), // Whether to enforce integer values
});

/**
 * Email field specific properties
 */
export const EmailFieldSchema = BaseFieldSchema.extend({
	type: z.literal("email"),
});

/**
 * URL field specific properties
 */
export const UrlFieldSchema = BaseFieldSchema.extend({
	type: z.literal("url"),
});

/**
 * Tel (phone) field specific properties
 */
export const TelFieldSchema = BaseFieldSchema.extend({
	type: z.literal("tel"),
	pattern: z.string().optional(),
	patternMessage: z.string().optional(),
});

/**
 * Date field specific properties
 */
export const DateFieldSchema = BaseFieldSchema.extend({
	type: z.literal("date"),
	minDate: z.string().optional(), // ISO date string or "today"
	maxDate: z.string().optional(),
});

/**
 * Datetime field specific properties
 */
export const DatetimeFieldSchema = BaseFieldSchema.extend({
	type: z.literal("datetime"),
	minDate: z.string().optional(),
	maxDate: z.string().optional(),
});

/**
 * Time field specific properties
 */
export const TimeFieldSchema = BaseFieldSchema.extend({
	type: z.literal("time"),
});

/**
 * Select field specific properties
 */
export const SelectFieldSchema = BaseFieldSchema.extend({
	type: z.literal("select"),
	options: z.array(FieldOptionSchema).min(1, "At least one option is required"),
});

/**
 * Radio field specific properties
 */
export const RadioFieldSchema = BaseFieldSchema.extend({
	type: z.literal("radio"),
	options: z.array(FieldOptionSchema).min(1, "At least one option is required"),
});

/**
 * Checkbox (boolean) field specific properties
 */
export const CheckboxFieldSchema = BaseFieldSchema.extend({
	type: z.literal("checkbox"),
	checkboxLabel: z.string().optional(), // Label shown next to checkbox
});

/**
 * Checkbox group (multi-select) field specific properties
 */
export const CheckboxGroupFieldSchema = BaseFieldSchema.extend({
	type: z.literal("checkboxGroup"),
	options: z.array(FieldOptionSchema).min(1, "At least one option is required"),
	minSelections: z.number().int().min(0).optional(),
	maxSelections: z.number().int().min(1).optional(),
});

/**
 * Union of all field types
 */
export const TicketFieldSchema = z.discriminatedUnion("type", [
	TextFieldSchema,
	TextareaFieldSchema,
	NumberFieldSchema,
	EmailFieldSchema,
	UrlFieldSchema,
	TelFieldSchema,
	DateFieldSchema,
	DatetimeFieldSchema,
	TimeFieldSchema,
	SelectFieldSchema,
	RadioFieldSchema,
	CheckboxFieldSchema,
	CheckboxGroupFieldSchema,
]);

export type TicketField = z.infer<typeof TicketFieldSchema>;

/**
 * Complete field schema for a ticket type
 */
export const TicketFieldsSchema = z.object({
	fields: z.array(TicketFieldSchema),
});

export type TicketFields = z.infer<typeof TicketFieldsSchema>;

// ============================================================================
// DYNAMIC VALIDATION
// ============================================================================

/**
 * Build a Zod schema dynamically from field definitions
 */
export function buildZodSchemaFromFields(fields: TicketField[]): z.ZodSchema {
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
				let numberSchema = z.number();
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
				fieldSchema = z
					.string()
					.regex(/^\d{4}-\d{2}-\d{2}$/, "Must be a valid date");
				break;

			case "datetime":
				// Accept ISO datetime string or datetime-local format
				fieldSchema = z
					.string()
					.refine(
						(val) => !Number.isNaN(Date.parse(val)),
						"Must be a valid date and time",
					);
				break;

			case "time":
				fieldSchema = z
					.string()
					.regex(/^\d{2}:\d{2}(:\d{2})?$/, "Must be a valid time");
				break;

			case "select":
			case "radio": {
				const validValues = field.options.map((o) => o.value);
				fieldSchema = z
					.string()
					.refine(
						(val) => validValues.includes(val),
						`Must be one of: ${validValues.join(", ")}`,
					);
				break;
			}

			case "checkbox":
				fieldSchema = z.boolean();
				break;

			case "checkboxGroup": {
				const validValues = field.options.map((o) => o.value);
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

		// Make optional if not required
		if (!field.required) {
			// For strings, allow empty string or undefined
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
				fieldSchema = fieldSchema.optional().or(z.literal(""));
			} else if (field.type === "checkbox") {
				fieldSchema = fieldSchema.optional();
			} else if (field.type === "checkboxGroup") {
				fieldSchema = fieldSchema.optional().or(z.array(z.string()).length(0));
			} else {
				fieldSchema = fieldSchema.optional();
			}
		} else {
			// For required string fields, enforce non-empty
			if (
				["text", "textarea", "email", "url", "tel", "select", "radio"].includes(
					field.type,
				)
			) {
				fieldSchema = z
					.string()
					.min(1, `${field.label} is required`)
					.pipe(fieldSchema as z.ZodString);
			}
		}

		shape[field.id] = fieldSchema;
	}

	return z.object(shape);
}

/**
 * Validate ticket data against a dynamic field schema
 */
export function validateTicketDataDynamic(
	fieldSchema: TicketFields | null | undefined,
	data: unknown,
):
	| { success: true; data: Record<string, unknown> }
	| { success: false; error: string } {
	// If no field schema defined, accept any object
	if (!fieldSchema || !fieldSchema.fields || fieldSchema.fields.length === 0) {
		if (typeof data === "object" && data !== null) {
			return { success: true, data: data as Record<string, unknown> };
		}
		return { success: false, error: "Invalid ticket data format" };
	}

	// Build schema from field definitions
	const schema = buildZodSchemaFromFields(fieldSchema.fields);
	const result = schema.safeParse(data);

	if (!result.success) {
		const errors = result.error.issues
			.map((issue) => {
				const path = issue.path.join(".");
				return path ? `${path}: ${issue.message}` : issue.message;
			})
			.join(", ");
		return { success: false, error: errors };
	}

	return { success: true, data: result.data as Record<string, unknown> };
}

/**
 * Get default values for a field schema
 */
export function getDefaultValuesFromFields(
	fields: TicketField[],
): Record<string, unknown> {
	const defaults: Record<string, unknown> = {};

	for (const field of fields) {
		if (field.defaultValue !== undefined) {
			defaults[field.id] = field.defaultValue;
		} else {
			// Set type-appropriate defaults
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

// ============================================================================
// LEGACY SUPPORT - Keep for backward compatibility during migration
// ============================================================================

/**
 * @deprecated Use validateTicketDataDynamic instead
 */
export function validateTicketData(
	ticketTypeName: string,
	data: unknown,
): { success: true; data: unknown } | { success: false; error: string } {
	// Legacy hardcoded schemas - will be removed after migration
	const legacySchemas: Record<string, z.ZodSchema> = {
		"inventory-request": z.object({
			itemName: z.string().min(1, "Item name is required").max(200),
			description: z.string().min(1, "Description is required").max(2000),
			purchaseLink: z
				.string()
				.url("Must be a valid URL")
				.optional()
				.or(z.literal("")),
			requestedAmount: z.number().int().min(1, "Amount must be at least 1"),
			urgency: z.enum(["low", "medium", "high", "critical"]),
		}),
		concern: z.object({
			concernType: z.enum([
				"safety",
				"equipment",
				"cleanliness",
				"behavior",
				"accessibility",
				"other",
			]),
			description: z.string().min(1, "Description is required").max(5000),
			timestamp: z.string().datetime().optional().or(z.literal("")),
		}),
	};

	const schema = legacySchemas[ticketTypeName];
	if (!schema) {
		return { success: false, error: `Unknown ticket type: ${ticketTypeName}` };
	}

	const result = schema.safeParse(data);
	if (!result.success) {
		const errors = result.error.issues
			.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
			.join(", ");
		return { success: false, error: errors };
	}

	return { success: true, data: result.data };
}
