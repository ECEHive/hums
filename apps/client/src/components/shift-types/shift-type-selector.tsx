import { trpc } from "@ecehive/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";
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

export type ShiftType = {
	id: number;
	name: string;
	location: string;
};

type ShiftTypeSelectorProps = {
	value: ShiftType | null;
	onChange: (shiftType: ShiftType | null) => void;
	periodId: number;
	placeholder?: string;
};

export function ShiftTypeSelector({
	value,
	onChange,
	periodId,
	placeholder = "Select shift type...",
}: ShiftTypeSelectorProps) {
	const [open, setOpen] = React.useState(false);
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

	// Map to minimal ShiftType shape
	const options: ShiftType[] = (data.shiftTypes || []).map((st) => ({
		id: st.id,
		name: st.name,
		location: st.location,
	}));

	function selectShiftType(shiftType: ShiftType) {
		onChange(shiftType);
		setOpen(false);
	}

	function clearSelection() {
		onChange(null);
		setOpen(false);
	}

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					role="combobox"
					aria-expanded={open}
					className="w-full justify-between"
				>
					<span className="truncate">
						{value ? `${value.name} (${value.location})` : placeholder}
					</span>
					<ChevronsUpDownIcon className="ml-2 size-4 shrink-0" />
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-[400px] p-0">
				<Command>
					<CommandInput
						placeholder="Search shift types..."
						value={query}
						onValueChange={setQuery}
					/>
					<CommandList>
						{isLoading ? (
							<CommandEmpty>Loading...</CommandEmpty>
						) : options.length === 0 ? (
							<CommandEmpty>No shift types found.</CommandEmpty>
						) : (
							<CommandGroup>
								{value && (
									<CommandItem
										value="clear"
										onSelect={clearSelection}
										className="text-muted-foreground"
									>
										Clear selection
									</CommandItem>
								)}
								{options.map((shiftType) => {
									const selected = value?.id === shiftType.id;
									return (
										<CommandItem
											key={shiftType.id}
											value={String(shiftType.id)}
											onSelect={() => {
												selectShiftType(shiftType);
											}}
										>
											{selected ? (
												<CheckIcon className="mr-2 size-4" />
											) : (
												<span className="mr-2 w-4" />
											)}
											<div className="flex flex-col">
												<span>{shiftType.name}</span>
												<span className="text-xs text-muted-foreground">
													{shiftType.location}
												</span>
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
