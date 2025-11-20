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
import type { AuditLogFilterApiToken } from "./types";
import {
	formatAuditLogApiTokenPrimary,
	formatAuditLogApiTokenSecondary,
} from "./utils";

export type AuditLogApiTokenSelectorProps = {
	value: AuditLogFilterApiToken | null;
	onChange: (value: AuditLogFilterApiToken | null) => void;
	placeholder?: string;
};

export function AuditLogApiTokenSelector({
	value,
	onChange,
	placeholder = "Search API tokens...",
}: AuditLogApiTokenSelectorProps) {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const debounced = useDebounce(query, 250);
	const search = debounced.trim() || undefined;

	const { data, isFetching } = useQuery<AuditLogFilterApiToken[]>({
		queryKey: ["apiTokens", "list", search],
		queryFn: async () => {
			const result = await trpc.apiTokens.list.query({
				search,
				limit: 25,
			});
			return result.tokens.map((token) => ({
				id: token.id,
				name: token.name,
				prefix: token.prefix,
			}));
		},
		enabled: open,
		staleTime: 60_000,
	});

	useEffect(() => {
		if (!open) setQuery("");
	}, [open]);

	const tokens = data ?? [];
	const showLoading = isFetching && tokens.length === 0;

	const handleSelect = (token: AuditLogFilterApiToken | null) => {
		onChange(token);
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
					<span className="flex w-full flex-col items-start text-left">
						{value ? (
							<>
								<span className="truncate">
									{formatAuditLogApiTokenPrimary(value)}
								</span>
								{formatAuditLogApiTokenSecondary(value) ? (
									<span className="text-xs text-muted-foreground">
										{formatAuditLogApiTokenSecondary(value)}
									</span>
								) : null}
							</>
						) : (
							<span className="text-muted-foreground">{placeholder}</span>
						)}
					</span>
					<ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-[360px] p-0">
				<Command>
					<CommandInput
						placeholder="Search API tokens..."
						value={query}
						onValueChange={setQuery}
					/>
					<CommandList>
						{showLoading ? (
							<CommandEmpty>Searching...</CommandEmpty>
						) : tokens.length === 0 ? (
							<CommandEmpty>No API tokens found.</CommandEmpty>
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
								{tokens.map((token) => {
									const selected = token.id === value?.id;
									return (
										<CommandItem
											key={token.id}
											value={`${token.id}`}
											onSelect={() => handleSelect(token)}
											className="items-start"
										>
											{selected ? (
												<CheckIcon className="mt-0.5 mr-2 size-4" />
											) : (
												<span className="mr-2 w-4 shrink-0" />
											)}
											<div className="flex flex-col">
												<span>{formatAuditLogApiTokenPrimary(token)}</span>
												{formatAuditLogApiTokenSecondary(token) ? (
													<span className="text-xs text-muted-foreground">
														{formatAuditLogApiTokenSecondary(token)}
													</span>
												) : null}
											</div>
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
