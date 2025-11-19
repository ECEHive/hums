import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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

export type PeriodUserOption = {
	id: number;
	name: string | null;
	username: string;
	email: string | null;
};

export type PeriodUserSelectorProps = {
	periodId: number | null;
	value: PeriodUserOption | null;
	onChange: (value: PeriodUserOption | null) => void;
	placeholder?: string;
	disabled?: boolean;
};

function getDisplayLabel(user: PeriodUserOption) {
	const primary = user.name || user.username;
	const secondary = user.email ?? user.username;
	return secondary && secondary !== primary
		? `${primary} (${secondary})`
		: primary;
}

export function PeriodUserSelector({
	periodId,
	value,
	onChange,
	placeholder = "Select user",
	disabled = false,
}: PeriodUserSelectorProps) {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const debounced = useDebounce(query, 250).trim();
	const search = debounced.length > 0 ? debounced : undefined;
	const isDisabled = disabled || !periodId;

	useEffect(() => {
		if (!open) {
			setQuery("");
		}
	}, [open]);

	const { data, isFetching } = useQuery({
		queryKey: ["period-users", periodId, search],
		queryFn: async () => {
			if (!periodId) return [] as PeriodUserOption[];
			const response = await trpc.shiftSchedules.listEligibleUsers.query({
				periodId,
				search,
			});
			return response.users.map((user) => ({
				id: user.id,
				name: user.name,
				username: user.username,
				email: user.email,
			}));
		},
		enabled: open && Boolean(periodId),
		staleTime: 60_000,
		select: (users) => users ?? [],
	});

	const users = data ?? [];
	const showLoading = isFetching && users.length === 0;

	const buttonLabel = useMemo(() => {
		if (!value) {
			return <span className="text-muted-foreground">{placeholder}</span>;
		}
		return getDisplayLabel(value);
	}, [value, placeholder]);

	return (
		<Popover open={open && !isDisabled} onOpenChange={(next) => setOpen(next)}>
			<PopoverTrigger asChild>
				<Button
					type="button"
					variant="outline"
					role="combobox"
					aria-expanded={open}
					className="w-full justify-between"
					disabled={isDisabled}
				>
					<span className="truncate text-left">{buttonLabel}</span>
					<ChevronsUpDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-[320px] p-0">
				<Command shouldFilter={false}>
					<CommandInput
						placeholder="Search users..."
						value={query}
						onValueChange={setQuery}
					/>
					<CommandList>
						{showLoading ? (
							<CommandEmpty>Searching...</CommandEmpty>
						) : users.length === 0 ? (
							<CommandEmpty>No users found</CommandEmpty>
						) : (
							<CommandGroup>
								{value ? (
									<CommandItem
										value="clear"
										onSelect={() => {
											onChange(null);
											setOpen(false);
										}}
										className="text-muted-foreground"
									>
										Clear selection
									</CommandItem>
								) : null}
								{users.map((user) => {
									const isSelected = user.id === value?.id;
									return (
										<CommandItem
											key={user.id}
											value={getDisplayLabel(user).toLowerCase()}
											onSelect={() => {
												onChange(user);
												setOpen(false);
											}}
										>
											{isSelected ? (
												<CheckIcon className="mr-2 h-4 w-4" />
											) : (
												<span className="mr-2 w-4" />
											)}
											<span className="truncate">{getDisplayLabel(user)}</span>
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
