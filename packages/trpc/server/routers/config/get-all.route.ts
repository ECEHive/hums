import {
	ConfigRegistry,
	ConfigService,
	REDACTED_PLACEHOLDER,
} from "@ecehive/features";

interface GetAllResult {
	definitions: {
		namespace: string;
		groups: {
			id: string;
			label: string;
			description?: string;
			icon?: string;
			fields: {
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
			}[];
		}[];
	}[];
	values: Record<string, unknown>;
}

export async function getAllHandler(): Promise<GetAllResult> {
	// Get all configuration definitions
	const allDefinitions = ConfigRegistry.getAll();
	const definitions = Array.from(allDefinitions.entries()).map(
		([namespace, def]) => ({
			namespace,
			groups: def.groups.map((group) => ({
				id: group.id,
				label: group.label,
				description: group.description,
				icon: group.icon,
				fields: group.fields.map((field) => ({
					key: field.key,
					label: field.label,
					description: field.description,
					type: field.type,
					defaultValue: field.defaultValue,
					options: field.options,
					placeholder: field.placeholder,
					min: field.min,
					max: field.max,
					step: field.step,
					required: field.required,
					// Note: We don't serialize the showWhen function
					// Client will handle conditional rendering based on values
				})),
			})),
		}),
	);

	// Get all current values
	const values = await ConfigService.getAll();

	// Redact sensitive values (type: "secret") before sending to client
	// This prevents exposure of secrets like API keys, signing secrets, etc.
	const sensitiveKeys = ConfigRegistry.getSensitiveKeys();
	const redactedValues: Record<string, unknown> = {};

	for (const [key, value] of Object.entries(values)) {
		if (sensitiveKeys.has(key)) {
			// Return placeholder if secret has a value, empty string if not set
			// This tells the UI whether a secret is configured without exposing it
			redactedValues[key] =
				value && typeof value === "string" && value.length > 0
					? REDACTED_PLACEHOLDER
					: "";
		} else {
			redactedValues[key] = value;
		}
	}

	return {
		definitions,
		values: redactedValues,
	};
}
