import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import * as React from "react";
import {
	type MultiSelectOption,
	SearchableMultiSelect,
} from "@/components/ui/searchable-multi-select";
import { useDebounce } from "@/lib/debounce";

export type Role = { id: number; name: string };

type RoleMultiSelectSingleProps = {
	value: Role | null;
	onChange: (role: Role | null) => void;
	placeholder?: string;
	onAdd?: (role: Role) => Promise<void> | void;
	onRemove?: (role: Role) => Promise<void> | void;
	selectionMode: "single";
};

type RoleMultiSelectMultipleProps = {
	value: Role[];
	onChange: (roles: Role[]) => void;
	placeholder?: string;
	onAdd?: (role: Role) => Promise<void> | void;
	onRemove?: (role: Role) => Promise<void> | void;
	selectionMode?: "multiple";
};

type RoleMultiSelectProps =
	| RoleMultiSelectSingleProps
	| RoleMultiSelectMultipleProps;

export function RoleMultiSelect(props: RoleMultiSelectProps) {
	const selectionMode = props.selectionMode ?? "multiple";
	const {
		placeholder = `Select role${selectionMode === "single" ? "" : "s"}...`,
		onAdd,
		onRemove,
	} = props;
	const value = props.value;
	const onChange = props.onChange;
	const [query, setQuery] = React.useState("");
	const debounced = useDebounce(query, 250);

	const { data = { roles: [], total: 0 }, isLoading } = useQuery({
		queryKey: ["roles", debounced],
		queryFn: async () => {
			return await trpc.roles.list.query({
				search: debounced.trim() === "" ? undefined : debounced.trim(),
				limit: 25,
			});
		},
		retry: false,
	});

	// Convert to MultiSelectOption format
	const options: MultiSelectOption<number>[] = React.useMemo(
		() =>
			(data.roles || []).map((r) => ({
				id: r.id,
				label: r.name,
			})),
		[data.roles],
	);

	// Convert value to MultiSelectOption format
	const selectedOptions: MultiSelectOption<number>[] = React.useMemo(() => {
		var selectedRoles: Role[];
		var val: Role[] | Role | null = value ?? [];
		if (typeof val === "object" && "id" in val) {
			// Single mode
			selectedRoles = val ? [val] : [];
		} else {
			// Multiple mode
			selectedRoles = (value as Role[]) || [];
		}
		return selectedRoles.map((r) => ({
			id: r.id,
			label: r.name,
		}));
	}, [value, selectionMode]);

	// Handle selection changes
	const handleChange = React.useCallback(
		(newOptions: MultiSelectOption<number>[]) => {
			const nextRoles = newOptions.map((opt) => ({
				id: opt.id,
				name: opt.label,
			}));
			if (selectionMode === "single") {
				(onChange as (role: Role | null) => void)(nextRoles[0] ?? null);
				return;
			}
			(onChange as (roles: Role[]) => void)(nextRoles);
		},
		[onChange, selectionMode],
	);

	// Handle add with optimistic update
	const handleAdd = React.useCallback(
		async (option: MultiSelectOption<number>) => {
			if (onAdd) {
				await onAdd({ id: option.id, name: option.label });
			}
		},
		[onAdd],
	);

	// Handle remove with optimistic update
	const handleRemove = React.useCallback(
		async (option: MultiSelectOption<number>) => {
			if (onRemove) {
				await onRemove({ id: option.id, name: option.label });
			}
		},
		[onRemove],
	);

	return (
		<SearchableMultiSelect
			value={selectedOptions}
			onChange={handleChange}
			options={options}
			placeholder={placeholder}
			searchPlaceholder="Search roles..."
			emptyMessage="No roles found."
			isLoading={isLoading}
			searchValue={query}
			onSearchChange={setQuery}
			onAdd={onAdd ? handleAdd : undefined}
			onRemove={onRemove ? handleRemove : undefined}
			popoverWidth="w-[300px]"
			selectionMode={selectionMode}
		/>
	);
}
