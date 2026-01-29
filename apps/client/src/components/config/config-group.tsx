import {
	Clock as ClockIcon,
	Settings as SettingsIcon,
	Slack as SlackIcon,
} from "lucide-react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { ConfigField } from "./config-field";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
	Clock: ClockIcon,
	Settings: SettingsIcon,
	Slack: SlackIcon,
};

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

interface ConfigGroupDef {
	id: string;
	label: string;
	description?: string;
	icon?: string;
	fields: ConfigFieldDef[];
}

interface ConfigGroupProps {
	group: ConfigGroupDef;
	values: Record<string, unknown>;
	canWrite: boolean;
	shouldShowField: (field: ConfigFieldDef) => boolean;
	onChange: (key: string, value: unknown) => void;
	onReset: (key: string) => void;
}

export function ConfigGroup({
	group,
	values,
	canWrite,
	shouldShowField,
	onChange,
	onReset,
}: ConfigGroupProps) {
	// Get icon component if specified
	const IconComponent = group.icon ? iconMap[group.icon] : null;

	// Filter fields based on conditional logic
	const visibleFields = group.fields.filter(shouldShowField);

	if (visibleFields.length === 0) return null;

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					{IconComponent && <IconComponent className="h-5 w-5" />}
					{group.label}
				</CardTitle>
				{group.description && (
					<CardDescription>{group.description}</CardDescription>
				)}
			</CardHeader>
			<CardContent className="space-y-6">
				{visibleFields.map((field) => (
					<ConfigField
						key={field.key}
						field={field}
						value={values[field.key] ?? field.defaultValue}
						canWrite={canWrite}
						onChange={(value) => onChange(field.key, value)}
						onReset={() => onReset(field.key)}
					/>
				))}
			</CardContent>
		</Card>
	);
}
