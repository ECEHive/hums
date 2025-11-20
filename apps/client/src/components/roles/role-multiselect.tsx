import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { CheckIcon, ChevronsUpDownIcon, Trash2, XIcon } from "lucide-react";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
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

	// Map to minimal Role shape
	const options: Role[] = (data.roles || []).map((r) => ({
		id: r.id,
		name: r.name,
	}));

	async function addRole(role: Role) {
		if (value.find((r) => r.id === role.id)) return;
		const previous = value;
		onChange([...value, role]);
		if (onAdd) {
			try {
				await onAdd(role);
			} catch (err) {
				// revert optimistic
				onChange(previous);
				throw err;
			}
		}
	}

	async function removeRole(id: number) {
		const previous = value;
		const role = value.find((r) => r.id === id);
		onChange(value.filter((r) => r.id !== id));
		if (onRemove && role) {
			try {
				await onRemove(role);
			} catch (err) {
				// revert optimistic
				onChange(previous);
				throw err;
			}
		}
	}

	return (
		<div className="flex justify-between gap-2">
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger asChild>
					<Button
						variant="outline"
						role="combobox"
						aria-expanded={open}
						className="flex-grow justify-between whitespace-normal h-auto"
					>
						<div className="flex items-center gap-2 flex-wrap">
							{value.length === 0 ? (
								<span className="text-muted-foreground">{placeholder}</span>
							) : null}
							{value.map((r) => (
								<Badge
									key={r.id}
									variant="secondary"
									className="flex items-center gap-1"
								>
									<span>{r.name}</span>
									<button
										type="button"
										onClick={(e) => {
											e.stopPropagation();
											removeRole(r.id);
										}}
										aria-label={`Remove ${r.name}`}
										className="-mr-1"
									>
										<XIcon className="size-3" />
									</button>
								</Badge>
							))}
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
										const selected = Boolean(
											value.find((r) => r.id === role.id),
										);
										return (
											<CommandItem
												key={role.id}
												value={String(role.id)}
												onSelect={() => {
													// Toggle selection: if selected, remove; otherwise add
													if (selected) {
														removeRole(role.id);
													} else {
														addRole(role);
													}
													// Keep the popover open for further selections
												}}
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
			<Button
				className="h-auto"
				variant="outline"
				aria-label="Clear all roles"
				onClick={() => {
					onChange([]);
				}}
			>
				<Trash2 className="size-4" />
			</Button>
		</div>
	);
}
