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

export interface ConfigField<K extends string = string, T = unknown> {
	key: K;
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
	// biome-ignore lint/suspicious/noExplicitAny: Required for generic field types
	fields: ConfigField[] | readonly ConfigField<string, any>[];
	// Conditional rendering: only show group if this function returns true
	showWhen?: (values: Record<string, unknown>) => boolean;
}

export interface ConfigDefinition {
	groups: ConfigGroup[] | readonly ConfigGroup[];
}

export interface ConfigValue {
	key: string;
	value: unknown;
}

export interface ConfigState {
	[key: string]: unknown;
}

/**
 * Extract key-value type mapping from a ConfigField
 */
export type ExtractFieldType<F> =
	F extends ConfigField<infer K, infer T> ? { [P in K]: T } : never;

/**
 * Extract key-value type mapping from an array of ConfigFields
 */
export type ExtractFieldsType<
	// biome-ignore lint/suspicious/noExplicitAny: Required for recursive type
	Fields extends readonly ConfigField<string, any>[],
> = Fields extends readonly [infer First, ...infer Rest]
	? // biome-ignore lint/suspicious/noExplicitAny: Required for type inference
		First extends ConfigField<string, any>
		? // biome-ignore lint/suspicious/noExplicitAny: Required for recursive type
			Rest extends readonly ConfigField<string, any>[]
			? ExtractFieldType<First> & ExtractFieldsType<Rest>
			: ExtractFieldType<First>
		: // biome-ignore lint/complexity/noBannedTypes: Empty object type used as fallback
			{}
	: // biome-ignore lint/complexity/noBannedTypes: Empty object type used as fallback
		{};

/**
 * Extract key-value type mapping from a ConfigDefinition
 */
export type ExtractConfigType<Def extends ConfigDefinition> = Def extends {
	groups: readonly (infer G)[];
}
	? G extends { fields: infer F }
		? // biome-ignore lint/suspicious/noExplicitAny: Required for field type inference
			F extends readonly ConfigField<string, any>[]
			? ExtractFieldsType<F>
			: // biome-ignore lint/complexity/noBannedTypes: Empty object type used as fallback
				{}
		: // biome-ignore lint/complexity/noBannedTypes: Empty object type used as fallback
			{}
	: // biome-ignore lint/complexity/noBannedTypes: Empty object type used as fallback
		{};

/**
 * Helper function to define a configuration with proper type inference
 * Automatically applies const assertions to enable type extraction
 *
 * @example
 * export const myConfig = defineConfig({
 *   groups: [
 *     {
 *       id: "my-group",
 *       fields: [
 *         { key: "my.key", type: "boolean", defaultValue: true }
 *       ]
 *     }
 *   ]
 * });
 */
export function defineConfig<T extends ConfigDefinition>(config: T): T {
	return config;
}
