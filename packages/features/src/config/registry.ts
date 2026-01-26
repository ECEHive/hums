import { z } from "zod";
import type { ConfigDefinition, ConfigField } from "./types";

/**
 * Configuration Registry
 * Central registry for all configuration definitions in the system
 */
const definitions = new Map<string, ConfigDefinition>();
const schemaCache = new Map<string, z.ZodType>();

export const ConfigRegistry = {
	/**
	 * Register a configuration definition
	 */
	register(namespace: string, definition: ConfigDefinition): void {
		if (definitions.has(namespace)) {
			throw new Error(
				`Configuration namespace "${namespace}" is already registered`,
			);
		}
		definitions.set(namespace, definition);
	},

	/**
	 * Get a configuration definition
	 */
	get(namespace: string): ConfigDefinition | undefined {
		return definitions.get(namespace);
	},

	/**
	 * Get all registered configuration definitions
	 */
	getAll(): Map<string, ConfigDefinition> {
		return new Map(definitions);
	},

	/**
	 * Get all configuration keys with their default values
	 */
	getAllDefaults(): Record<string, unknown> {
		const defaults: Record<string, unknown> = {};

		for (const definition of Array.from(definitions.values())) {
			for (const group of definition.groups) {
				for (const field of group.fields) {
					defaults[field.key] = field.defaultValue;
				}
			}
		}

		return defaults;
	},

	/**
	 * Get default value for a specific key
	 */
	getDefault(key: string): unknown {
		for (const definition of Array.from(definitions.values())) {
			for (const group of definition.groups) {
				for (const field of group.fields) {
					if (field.key === key) {
						return field.defaultValue;
					}
				}
			}
		}
		return undefined;
	},

	/**
	 * Generate a Zod schema for a field based on its definition
	 */
	getFieldSchema(field: ConfigField): z.ZodType {
		switch (field.type) {
			case "number": {
				let schema = z.number();

				// Apply min constraint
				if (field.min !== undefined) {
					schema = schema.min(
						field.min,
						`${field.label} must be at least ${field.min}`,
					);
				}

				// Apply max constraint
				if (field.max !== undefined) {
					schema = schema.max(
						field.max,
						`${field.label} must be at most ${field.max}`,
					);
				}

				// Apply step constraint (validate that number is a multiple)
				if (field.step !== undefined && field.step > 0) {
					const step = field.step;
					const min = field.min ?? 0;
					schema = schema.refine(
						(val) => {
							const offset = val - min;
							// Round to nearest step and check if close to original value
							// This handles floating point precision issues better than modulo
							const rounded = Math.round(offset / step) * step;
							// Use a tolerance that scales with the magnitude of the values to
							// avoid incorrect results for very large or very small numbers.
							const scale = Math.max(1, Math.abs(offset), Math.abs(step));
							const tolerance = Number.EPSILON * scale * 10;
							return Math.abs(rounded - offset) <= tolerance;
						},
						{
							message: `${field.label} must be a multiple of ${field.step}`,
						},
					);
				}

				return schema;
			}

			case "boolean":
				return z.boolean();

			case "text":
			case "textarea": {
				const schema = z.string();

				return schema;
			}

			case "select": {
				if (!field.options || field.options.length === 0) {
					return z.string();
				}

				// Create enum from options
				const validValues = field.options.map((opt) => opt.value);
				if (validValues.length === 1) {
					return z.literal(validValues[0]);
				}
				return z.union([
					z.literal(validValues[0]),
					z.literal(validValues[1]),
					...(validValues.slice(2).map((v) => z.literal(v)) as [
						z.ZodLiteral<string>,
						...z.ZodLiteral<string>[],
					]),
				]);
			}

			case "multiselect": {
				if (!field.options || field.options.length === 0) {
					return z.array(z.string());
				}

				// Create enum array from options
				const validValues = field.options.map((opt) => opt.value);
				let itemSchema: z.ZodType;

				if (validValues.length === 1) {
					itemSchema = z.literal(validValues[0]);
				} else if (validValues.length === 2) {
					itemSchema = z.union([
						z.literal(validValues[0]),
						z.literal(validValues[1]),
					]);
				} else {
					itemSchema = z.enum(validValues as [string, string, ...string[]]);
				}

				return z.array(itemSchema);
			}

			case "svg-upload": {
				// SVG content validation
				return z.string().refine(
					(content) => {
						const trimmed = content.trim();
						// Must start with SVG or XML declaration
						if (!trimmed.startsWith("<svg") && !trimmed.startsWith("<?xml")) {
							return false;
						}
						// Must contain an SVG element
						if (!trimmed.includes("<svg")) {
							return false;
						}
						// No script tags
						if (/<script/i.test(trimmed)) {
							return false;
						}
						// No event handlers
						if (/\son\w+=/i.test(trimmed)) {
							return false;
						}
						// No javascript URLs
						if (/javascript:/i.test(trimmed)) {
							return false;
						}
						// Max 500KB
						if (trimmed.length > 500 * 1024) {
							return false;
						}
						return true;
					},
					{
						message:
							"Invalid SVG: Must be valid SVG without scripts or event handlers (max 500KB)",
					},
				);
			}

			default:
				return z.unknown();
		}
	},

	/**
	 * Get or create a cached Zod schema for a configuration key
	 */
	getSchema(key: string): z.ZodType | undefined {
		// Check cache first
		if (schemaCache.has(key)) {
			return schemaCache.get(key);
		}

		// Find the field definition
		for (const definition of Array.from(definitions.values())) {
			for (const group of definition.groups) {
				for (const field of group.fields) {
					if (field.key === key) {
						const schema = this.getFieldSchema(field);
						schemaCache.set(key, schema);
						return schema;
					}
				}
			}
		}

		return undefined;
	},

	/**
	 * Validate a configuration value using Zod
	 */
	validate(
		key: string,
		value: unknown,
	): { success: true } | { success: false; error: string } {
		const schema = this.getSchema(key);

		if (!schema) {
			return { success: false, error: `Unknown configuration key: ${key}` };
		}

		const result = schema.safeParse(value);

		if (result.success) {
			return { success: true };
		}

		// Format Zod error message
		const errorMessage = result.error.issues
			.map((err: { message: string }) => err.message)
			.join(", ");

		return { success: false, error: errorMessage };
	},

	/**
	 * Clear all registrations (useful for testing)
	 */
	clear(): void {
		definitions.clear();
	},
};
