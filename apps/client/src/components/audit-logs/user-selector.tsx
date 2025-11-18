import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";
import { useEffect, useState } from "react";
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
import type { AuditLogFilterUser } from "./types";
import { formatAuditLogUserLabel } from "./utils";

export type AuditLogUserSelectorProps = {
	value: AuditLogFilterUser | null;
	onChange: (value: AuditLogFilterUser | null) => void;
	placeholder?: string;
};

export function AuditLogUserSelector({
	value,
	onChange,
	placeholder = "Search users...",
}: AuditLogUserSelectorProps) {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const debounced = useDebounce(query, 250);
	const search = debounced.trim() || undefined;

	const { data, isFetching } = useQuery<AuditLogFilterUser[]>({
		queryKey: ["users", "list", search],
		queryFn: async () => {
			const result = await trpc.users.list.query({
				search,
				limit: 25,
			});
			return result.users.map((user) => ({
				id: user.id,
				name: user.name ?? "",
				username: user.username,
				email: user.email,
			}));
		},
		enabled: open,
		staleTime: 60_000,
	});

	useEffect(() => {
		if (!open) setQuery("");
	}, [open]);

	const users = data ?? [];
	const showLoading = isFetching && users.length === 0;

	const handleSelect = (user: AuditLogFilterUser | null) => {
		onChange(user);
		setOpen(false);
	};

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					type="button"
					variant="outline"
					role="combobox"
					aria-expanded={open}
					className="w-full justify-between"
				>
					<span className="truncate">
						{value ? (
							formatAuditLogUserLabel(value)
						) : (
							<span className="text-muted-foreground">{placeholder}</span>
						)}
					</span>
					<ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-[320px] p-0">
				<Command>
					<CommandInput
						placeholder="Search users..."
						value={query}
						onValueChange={setQuery}
					/>
					<CommandList>
						{showLoading ? (
							<CommandEmpty>Searching...</CommandEmpty>
						) : users.length === 0 ? (
							<CommandEmpty>No users found.</CommandEmpty>
						) : (
							<CommandGroup>
								{value ? (
									<CommandItem
										value="clear"
										onSelect={() => handleSelect(null)}
										className="text-muted-foreground"
									>
										Clear selection
									</CommandItem>
								) : null}
								{users.map((user) => {
									const selected = user.id === value?.id;
									return (
										<CommandItem
											key={user.id}
											value={`${user.id}`}
											onSelect={() => handleSelect(user)}
										>
											{selected ? (
												<CheckIcon className="mr-2 size-4" />
											) : (
												<span className="mr-2 w-4 shrink-0" />
											)}
											<span>{formatAuditLogUserLabel(user)}</span>
										</CommandItem>
									);
								})}
							</CommandGroup>
						)}
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
