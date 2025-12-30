import { ConfigRegistry, ConfigService } from "@ecehive/features";

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

	return {
		definitions,
		values,
	};
}
