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

export function ShiftTypeMultiselect({
	value,
	onChange,
	periodId,
	placeholder = "Select shift types...",
	onAdd,
	onRemove,
}: ShiftTypeMultiselectProps) {
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

	async function addShiftType(shiftType: ShiftType) {
		if (value.find((s) => s.id === shiftType.id)) return;
		const previous = value;
		onChange([...value, shiftType]);
		if (onAdd) {
			try {
				await onAdd(shiftType);
			} catch (err) {
				onChange(previous);
				throw err;
			}
		}
	}

	async function removeShiftType(id: number) {
		const previous = value;
		const st = value.find((s) => s.id === id);
		onChange(value.filter((s) => s.id !== id));
		if (onRemove && st) {
			try {
				await onRemove(st);
			} catch (err) {
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
						<div className="flex items-center gap-2 flex-wrap max-w-full">
							{value.length === 0 ? (
								<span className="text-muted-foreground">{placeholder}</span>
							) : null}
							{value.map((s) => (
								<Badge
									key={s.id}
									variant="secondary"
									className="flex items-center gap-1 max-w-[14rem] truncate"
								>
									<span className="truncate block">{s.name}</span>
									<button
										type="button"
										onClick={(e) => {
											e.stopPropagation();
											removeShiftType(s.id);
										}}
										aria-label={`Remove ${s.name}`}
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
									{options.map((shiftType) => {
										const selected = Boolean(
											value.find((s) => s.id === shiftType.id),
										);
										return (
											<CommandItem
												key={shiftType.id}
												value={`${shiftType.id}-${shiftType.name}-${shiftType.location}`}
												keywords={[shiftType.name, shiftType.location]}
												onSelect={() => {
													if (selected) {
														removeShiftType(shiftType.id);
													} else {
														addShiftType(shiftType);
													}
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
			<Button
				className="h-auto"
				variant="outline"
				aria-label="Clear all shift types"
				onClick={() => {
					onChange([]);
				}}
			>
				<Trash2 className="size-4" />
			</Button>
		</div>
	);
}
