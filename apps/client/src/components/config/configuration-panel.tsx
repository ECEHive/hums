import { trpc } from "@ecehive/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { SearchIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { checkPermissions } from "@/lib/permissions";
import { ConfigGroup } from "./config-group";

interface ConfigField {
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
	fields: ConfigField[];
}

interface ConfigDefinition {
	namespace: string;
	groups: ConfigGroupDef[];
}

interface ConfigurationPanelProps {
	definitions: ConfigDefinition[];
	initialValues: Record<string, unknown>;
}

export function ConfigurationPanel({
	definitions,
	initialValues,
}: ConfigurationPanelProps) {
	const { user } = useAuth();
	const canWrite = user ? checkPermissions(user, ["config.write"]) : false;
	const queryClient = useQueryClient();
	const [values, setValues] = useState<Record<string, unknown>>(initialValues);
	const [savedValues, setSavedValues] =
		useState<Record<string, unknown>>(initialValues);
	const [search, setSearch] = useState("");
	const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set());
	const [isSaving, setIsSaving] = useState(false);

	// Update saved values when initial values change (after fetch/reset)
	useEffect(() => {
		setSavedValues(initialValues);
		setValues(initialValues);
	}, [initialValues]);

	// Create a map of default values from definitions
	const defaultValues = useMemo(() => {
		const defaults: Record<string, unknown> = {};
		for (const def of definitions) {
			for (const group of def.groups) {
				for (const field of group.fields) {
					defaults[field.key] = field.defaultValue;
				}
			}
		}
		return defaults;
	}, [definitions]);

	// Calculate which values have changed
	const changedKeys = useMemo(() => {
		const keys: string[] = [];
		for (const key in values) {
			if (values[key] !== savedValues[key]) {
				keys.push(key);
			}
		}
		return keys;
	}, [values, savedValues]);

	const hasChanges = changedKeys.length > 0;

	const setManyMutation = useMutation({
		mutationFn: (valuesToSave: Record<string, unknown>) =>
			trpc.config.setMany.mutate({ values: valuesToSave }),
		onMutate: () => {
			setIsSaving(true);
		},
		onSuccess: (_, valuesToSave) => {
			// Update saved state to match current values
			setSavedValues((prev) => ({ ...prev, ...valuesToSave }));
			queryClient.invalidateQueries({ queryKey: ["config", "all"] });
			const count = Object.keys(valuesToSave).length;
			toast.success(`Updated ${count} configuration${count > 1 ? "s" : ""}`);
			setIsSaving(false);
		},
		onError: (error) => {
			toast.error("Failed to update configuration", {
				description: error.message,
			});
			setIsSaving(false);
		},
	});

	const resetValueMutation = useMutation({
		mutationFn: ({ key }: { key: string; defaultValue: unknown }) =>
			trpc.config.resetValue.mutate({ key }),
		onMutate: ({ key }) => {
			setSavingKeys((prev) => new Set(prev).add(key));
		},
		onSuccess: (_, { key, defaultValue }) => {
			// Reset both local and saved state to default value
			setValues((prev) => ({ ...prev, [key]: defaultValue }));
			setSavedValues((prev) => ({ ...prev, [key]: defaultValue }));
			queryClient.invalidateQueries({ queryKey: ["config", "all"] });
			toast.success("Configuration reset to default");
			setSavingKeys((prev) => {
				const next = new Set(prev);
				next.delete(key);
				return next;
			});
		},
		onError: (error, { key }) => {
			toast.error("Failed to reset configuration", {
				description: error.message,
			});
			setSavingKeys((prev) => {
				const next = new Set(prev);
				next.delete(key);
				return next;
			});
		},
	});

	const handleValueChange = useCallback((key: string, value: unknown) => {
		setValues((prev) => ({ ...prev, [key]: value }));
	}, []);

	const handleSaveAll = useCallback(() => {
		if (!canWrite || !hasChanges) return;

		// Build object of changed values
		const valuesToSave: Record<string, unknown> = {};
		for (const key of changedKeys) {
			valuesToSave[key] = values[key];
		}

		setManyMutation.mutate(valuesToSave);
	}, [canWrite, hasChanges, changedKeys, values, setManyMutation]);

	const handleReset = useCallback(
		(key: string) => {
			if (!canWrite) return;
			const defaultValue = defaultValues[key];
			resetValueMutation.mutate({ key, defaultValue });
		},
		[canWrite, defaultValues, resetValueMutation],
	);

	// Filter groups based on search
	const filteredDefinitions = useMemo(() => {
		if (!search.trim()) return definitions;

		const lowerSearch = search.toLowerCase();
		return definitions
			.map((def) => ({
				...def,
				groups: def.groups
					.map((group) => ({
						...group,
						fields: group.fields.filter(
							(field) =>
								field.label.toLowerCase().includes(lowerSearch) ||
								field.description?.toLowerCase().includes(lowerSearch) ||
								field.key.toLowerCase().includes(lowerSearch),
						),
					}))
					.filter((group) => group.fields.length > 0),
			}))
			.filter((def) => def.groups.length > 0);
	}, [definitions, search]);

	// Check if field should be shown based on conditional logic using current values
	const shouldShowField = useCallback(
		(field: ConfigField) => {
			// Since we can't serialize functions, we'll handle common patterns here
			// For the session timeout example:
			if (field.key.endsWith(".hours")) {
				const enabledKey = field.key.replace(".hours", ".enabled");
				// Use current values (not saved values) for conditional display
				return values[enabledKey] === true;
			}
			return true;
		},
		[values],
	);

	return (
		<div className="space-y-6">
			{/* Search and Save Button */}
			<div className="flex items-center gap-4">
				<div className="relative flex-1">
					<SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						placeholder="Search configuration options..."
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						className="pl-9"
					/>
				</div>
				{canWrite && (
					<Button onClick={handleSaveAll} disabled={!hasChanges || isSaving}>
						{isSaving
							? "Saving..."
							: `Save Changes${hasChanges ? ` (${changedKeys.length})` : ""}`}
					</Button>
				)}
			</div>

			{/* Configuration Groups */}
			{filteredDefinitions.length === 0 ? (
				<div className="text-center py-12 text-muted-foreground">
					No configuration options found
				</div>
			) : (
				<div className="space-y-6">
					{filteredDefinitions.map((definition) =>
						definition.groups.map((group) => (
							<ConfigGroup
								key={group.id}
								group={group}
								values={values}
								canWrite={canWrite}
								savingKeys={savingKeys}
								shouldShowField={shouldShowField}
								onChange={handleValueChange}
								onReset={handleReset}
							/>
						)),
					)}
				</div>
			)}
		</div>
	);
}
