import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import * as React from "react";
import {
	type MultiSelectOption,
	SearchableMultiSelect,
} from "@/components/ui/searchable-multi-select";
import { useDebounce } from "@/lib/debounce";

export type Role = { id: number; name: string };

type RoleMultiSelectProps = {
	value: Role[];
	onChange: (roles: Role[]) => void;
	placeholder?: string;
	onAdd?: (role: Role) => Promise<void> | void;
	onRemove?: (role: Role) => Promise<void> | void;
};

export function RoleMultiSelect({
	value,
	onChange,
	placeholder = "Select roles...",
	onAdd,
	onRemove,
}: RoleMultiSelectProps) {
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
	const selectedOptions: MultiSelectOption<number>[] = React.useMemo(
		() =>
			value.map((r) => ({
				id: r.id,
				label: r.name,
			})),
		[value],
	);

	// Handle selection changes
	const handleChange = React.useCallback(
		(newOptions: MultiSelectOption<number>[]) => {
			onChange(
				newOptions.map((opt) => ({
					id: opt.id,
					name: opt.label,
				})),
			);
		},
		[onChange],
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
		/>
	);
}
