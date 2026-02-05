import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import * as React from "react";
import {
	type MultiSelectOption,
	SearchableMultiSelect,
} from "@/components/ui/searchable-multi-select";
import { useDebounce } from "@/lib/debounce";

export type ShiftType = {
	id: number;
	name: string;
	location: string;
};

type ShiftTypeMultiselectProps = {
	value: ShiftType[];
	onChange: (shiftTypes: ShiftType[]) => void;
	periodId: number;
	placeholder?: string;
	onAdd?: (shiftType: ShiftType) => Promise<void> | void;
	onRemove?: (shiftType: ShiftType) => Promise<void> | void;
};

// Extended option type that includes the original ShiftType data
type ShiftTypeOption = MultiSelectOption<number> & {
	originalData: ShiftType;
};

export function ShiftTypeMultiselect({
	value,
	onChange,
	periodId,
	placeholder = "Select shift types...",
	onAdd,
	onRemove,
}: ShiftTypeMultiselectProps) {
	const [query, setQuery] = React.useState("");
	const debounced = useDebounce(query, 250);

	const { data = { shiftTypes: [], total: 0 }, isLoading } = useQuery({
		queryKey: ["shiftTypes", { periodId, search: debounced }],
		queryFn: async () => {
			return await trpc.shiftTypes.list.query({
				periodId,
				search: debounced.trim() === "" ? undefined : debounced.trim(),
				limit: 25,
			});
		},
		retry: false,
	});

	// Convert to MultiSelectOption format with original data preserved
	const options: ShiftTypeOption[] = React.useMemo(
		() =>
			(data.shiftTypes || []).map((st) => ({
				id: st.id,
				label: st.name,
				description: st.location,
				keywords: [st.name, st.location],
				originalData: { id: st.id, name: st.name, location: st.location },
			})),
		[data.shiftTypes],
	);

	// Convert value to MultiSelectOption format
	const selectedOptions: ShiftTypeOption[] = React.useMemo(
		() =>
			value.map((st) => ({
				id: st.id,
				label: st.name,
				description: st.location,
				keywords: [st.name, st.location],
				originalData: st,
			})),
		[value],
	);

	// Create a lookup map for original data
	const optionsMap = React.useMemo(() => {
		const map = new Map<number, ShiftType>();
		for (const opt of options) {
			map.set(opt.id, opt.originalData);
		}
		for (const opt of selectedOptions) {
			map.set(opt.id, opt.originalData);
		}
		return map;
	}, [options, selectedOptions]);

	// Handle selection changes
	const handleChange = React.useCallback(
		(newOptions: MultiSelectOption<number>[]) => {
			onChange(
				newOptions.map((opt) => {
					const original = optionsMap.get(opt.id);
					return (
						original ?? {
							id: opt.id,
							name: opt.label,
							location: opt.description ?? "",
						}
					);
				}),
			);
		},
		[onChange, optionsMap],
	);

	// Handle add with optimistic update
	const handleAdd = React.useCallback(
		async (option: MultiSelectOption<number>) => {
			if (onAdd) {
				const original = optionsMap.get(option.id);
				await onAdd(
					original ?? {
						id: option.id,
						name: option.label,
						location: option.description ?? "",
					},
				);
			}
		},
		[onAdd, optionsMap],
	);

	// Handle remove with optimistic update
	const handleRemove = React.useCallback(
		async (option: MultiSelectOption<number>) => {
			if (onRemove) {
				const original = optionsMap.get(option.id);
				await onRemove(
					original ?? {
						id: option.id,
						name: option.label,
						location: option.description ?? "",
					},
				);
			}
		},
		[onRemove, optionsMap],
	);

	return (
		<SearchableMultiSelect
			value={selectedOptions}
			onChange={handleChange}
			options={options}
			placeholder={placeholder}
			searchPlaceholder="Search shift types..."
			emptyMessage="No shift types found."
			isLoading={isLoading}
			searchValue={query}
			onSearchChange={setQuery}
			onAdd={onAdd ? handleAdd : undefined}
			onRemove={onRemove ? handleRemove : undefined}
			popoverWidth="w-[400px]"
		/>
	);
}
