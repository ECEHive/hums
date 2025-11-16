import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { CheckIcon, ChevronsUpDownIcon, XIcon } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
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
	const [open, setOpen] = React.useState(false);
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

	const options: Role[] = (data.roles || []).map((r) => ({
		id: r.id,
		name: r.name,
	}));

	function handleSelect(role: Role) {
		onChange(role);
		setOpen(false);
		setQuery("");
	}

	return (
		<div className="flex items-center gap-3">
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger asChild>
					<Button
						variant="outline"
						role="combobox"
						aria-expanded={open}
						className="flex-grow justify-between whitespace-normal h-auto"
					>
						<div className="flex items-center gap-2">
							{value ? (
								<span className="truncate">{value.name}</span>
							) : (
								<span className="text-muted-foreground">{placeholder}</span>
							)}
						</div>
						<ChevronsUpDownIcon className="ml-2 size-4" />
					</Button>
				</PopoverTrigger>
				<PopoverContent className="w-[300px] p-0">
					<Command>
						<CommandInput
							placeholder="Search roles..."
							value={query}
							onValueChange={setQuery}
						/>
						<CommandList>
							{isLoading ? (
								<CommandEmpty>Loading...</CommandEmpty>
							) : options.length === 0 ? (
								<CommandEmpty>No roles found.</CommandEmpty>
							) : (
								<CommandGroup>
									{options.map((role) => {
										const selected = Boolean(value && value.id === role.id);
										return (
											<CommandItem
												key={role.id}
												value={String(role.id)}
												onSelect={() => handleSelect(role)}
											>
												{selected ? (
													<CheckIcon className="mr-2 size-4" />
												) : (
													<span className="mr-2 w-4" />
												)}
												{role.name}
											</CommandItem>
										);
									})}
								</CommandGroup>
							)}
						</CommandList>
					</Command>
				</PopoverContent>
			</Popover>

			{/* Clear button when a value is selected */}
			{value ? (
				<Button
					variant="outline"
					aria-label="Clear role"
					onClick={() => onChange(null)}
				>
					<XIcon className="w-4 h-4" />
				</Button>
			) : null}
		</div>
	);
}
