/**
 * Configuration framework types
 * Defines the structure for building robust, type-safe configuration systems
 */

export type ConfigFieldType =
	| "text"
	| "number"
	| "boolean"
	| "select"
	| "multiselect"
	| "textarea";

export interface ConfigFieldOption {
	value: string;
	label: string;
}

export interface ConfigField<T = unknown> {
	key: string;
	label: string;
	description?: string;
	type: ConfigFieldType;
	defaultValue: T;
	options?: ConfigFieldOption[]; // For select/multiselect
	placeholder?: string;
	min?: number; // For number types
	max?: number; // For number types
	step?: number; // For number types
	required?: boolean;
	// Conditional rendering: only show if this function returns true
	showWhen?: (values: Record<string, unknown>) => boolean;
}

export interface ConfigGroup {
	id: string;
	label: string;
	description?: string;
	icon?: string;
	fields: ConfigField[];
	// Conditional rendering: only show group if this function returns true
	showWhen?: (values: Record<string, unknown>) => boolean;
}

export interface ConfigDefinition {
	groups: ConfigGroup[];
}

export interface ConfigValue {
	key: string;
	value: unknown;
}

export interface ConfigState {
	[key: string]: unknown;
}
