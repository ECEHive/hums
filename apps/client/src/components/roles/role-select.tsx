import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import * as React from "react";
import {
	SearchableSelect,
	type SelectOption,
} from "@/components/ui/searchable-select";
import { useDebounce } from "@/lib/debounce";

export type Role = { id: number; name: string };

type RoleSelectProps = {
	value?: Role | null;
	onChange: (role: Role | null) => void;
	placeholder?: string;
};

export function RoleSelect({
	value,
	onChange,
	placeholder = "Select role...",
}: RoleSelectProps) {
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

	// Convert to SelectOption format
	const options: SelectOption<number>[] = React.useMemo(
		() =>
			(data.roles || []).map((r) => ({
				id: r.id,
				label: r.name,
			})),
		[data.roles],
	);

	// Convert value to SelectOption format
	const selectedOption: SelectOption<number> | null = value
		? { id: value.id, label: value.name }
		: null;

	// Handle selection changes
	const handleChange = React.useCallback(
		(option: SelectOption<number> | null) => {
			onChange(option ? { id: option.id, name: option.label } : null);
		},
		[onChange],
	);

	return (
		<SearchableSelect
			value={selectedOption}
			onChange={handleChange}
			options={options}
			placeholder={placeholder}
			searchPlaceholder="Search roles..."
			emptyMessage="No roles found."
			isLoading={isLoading}
			searchValue={query}
			onSearchChange={setQuery}
			popoverWidth="w-[300px]"
		/>
	);
}
