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
	const [open, setOpen] = React.useState(false);
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

	// Map to minimal ControlPoint shape
	const options: ControlPoint[] = (data.points || []).map((p) => ({
		id: p.id,
		name: p.name,
	}));

	async function addPoint(point: ControlPoint) {
		if (value.find((p) => p.id === point.id)) return;
		const previous = value;
		onChange([...value, point]);
		if (onAdd) {
			try {
				await onAdd(point);
			} catch (err) {
				// revert optimistic
				onChange(previous);
				throw err;
			}
		}
	}

	async function removePoint(id: string) {
		const previous = value;
		const point = value.find((p) => p.id === id);
		onChange(value.filter((p) => p.id !== id));
		if (onRemove && point) {
			try {
				await onRemove(point);
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
						className="flex-grow justify-between whitespace-normal h-auto min-h-10"
					>
						<div className="flex items-center gap-2 flex-wrap">
							{value.length === 0 ? (
								<span className="text-muted-foreground">{placeholder}</span>
							) : null}
							{value.map((p) => (
								<Badge
									key={p.id}
									variant="secondary"
									className="flex items-center gap-1"
								>
									<span>{p.name}</span>
									<button
										type="button"
										onClick={(e) => {
											e.stopPropagation();
											removePoint(p.id);
										}}
										aria-label={`Remove ${p.name}`}
										className="-mr-1"
									>
										<XIcon className="size-3" />
									</button>
								</Badge>
							))}
						</div>
						<ChevronsUpDownIcon className="ml-2 size-4 shrink-0" />
					</Button>
				</PopoverTrigger>
				<PopoverContent className="w-[350px] p-0">
					<Command>
						<CommandInput
							placeholder="Search control points..."
							value={query}
							onValueChange={setQuery}
						/>
						<CommandList>
							{isLoading ? (
								<CommandEmpty>Loading...</CommandEmpty>
							) : options.length === 0 ? (
								<CommandEmpty>No control points found.</CommandEmpty>
							) : (
								<CommandGroup>
									{options.map((point) => {
										const selected = Boolean(
											value.find((p) => p.id === point.id),
										);
										return (
											<CommandItem
												key={point.id}
												value={point.id}
												onSelect={() => {
													// Toggle selection: if selected, remove; otherwise add
													if (selected) {
														removePoint(point.id);
													} else {
														addPoint(point);
													}
													// Keep the popover open for further selections
												}}
											>
												{selected ? (
													<CheckIcon className="mr-2 size-4" />
												) : (
													<span className="mr-2 w-4" />
												)}
												{point.name}
											</CommandItem>
										);
									})}
								</CommandGroup>
							)}
						</CommandList>
					</Command>
				</PopoverContent>
			</Popover>
			{value.length > 0 && (
				<Button
					className="h-auto"
					variant="outline"
					aria-label="Clear all control points"
					onClick={() => {
						onChange([]);
					}}
				>
					<Trash2 className="size-4" />
				</Button>
			)}
		</div>
	);
}
