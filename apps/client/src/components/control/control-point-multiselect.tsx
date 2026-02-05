import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import * as React from "react";
import {
	type MultiSelectOption,
	SearchableMultiSelect,
} from "@/components/ui/searchable-multi-select";
import { useDebounce } from "@/lib/debounce";

export type ControlPoint = { id: string; name: string };

type ControlPointMultiSelectProps = {
	value: ControlPoint[];
	onChange: (points: ControlPoint[]) => void;
	placeholder?: string;
	onAdd?: (point: ControlPoint) => Promise<void> | void;
	onRemove?: (point: ControlPoint) => Promise<void> | void;
};

export function ControlPointMultiSelect({
	value,
	onChange,
	placeholder = "Select control points...",
	onAdd,
	onRemove,
}: ControlPointMultiSelectProps) {
	const [query, setQuery] = React.useState("");
	const debounced = useDebounce(query, 250);

	const { data = { points: [], total: 0 }, isLoading } = useQuery({
		queryKey: ["controlPoints", "list", debounced],
		queryFn: async () => {
			return await trpc.control.points.list.query({
				search: debounced.trim() === "" ? undefined : debounced.trim(),
				isActive: true,
				limit: 25,
			});
		},
		retry: false,
	});

	// Convert to MultiSelectOption format
	const options: MultiSelectOption<string>[] = React.useMemo(
		() =>
			(data.points || []).map((p) => ({
				id: p.id,
				label: p.name,
			})),
		[data.points],
	);

	// Convert value to MultiSelectOption format
	const selectedOptions: MultiSelectOption<string>[] = React.useMemo(
		() =>
			value.map((p) => ({
				id: p.id,
				label: p.name,
			})),
		[value],
	);

	// Handle selection changes
	const handleChange = React.useCallback(
		(newOptions: MultiSelectOption<string>[]) => {
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
		async (option: MultiSelectOption<string>) => {
			if (onAdd) {
				await onAdd({ id: option.id, name: option.label });
			}
		},
		[onAdd],
	);

	// Handle remove with optimistic update
	const handleRemove = React.useCallback(
		async (option: MultiSelectOption<string>) => {
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
			searchPlaceholder="Search control points..."
			emptyMessage="No control points found."
			isLoading={isLoading}
			searchValue={query}
			onSearchChange={setQuery}
			onAdd={onAdd ? handleAdd : undefined}
			onRemove={onRemove ? handleRemove : undefined}
			popoverWidth="w-[350px]"
		/>
	);
}
