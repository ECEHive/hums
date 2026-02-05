import { CheckIcon, ChevronsUpDownIcon, Trash2Icon, XIcon } from "lucide-react";
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
import { cn } from "@/lib/utils";

export type MultiSelectOption<T = string | number> = {
	/** Unique identifier for the option */
	id: T;
	/** Display label for the option */
	label: string;
	/** Optional secondary text displayed below the label */
	description?: string;
	/** Additional keywords for search matching */
	keywords?: string[];
};

export type SearchableMultiSelectProps<T = string | number> = {
	/** Currently selected options */
	value: MultiSelectOption<T>[];
	/** Callback when selection changes */
	onChange: (options: MultiSelectOption<T>[]) => void;
	/** Available options to choose from */
	options: MultiSelectOption<T>[];
	/** Placeholder when no selection */
	placeholder?: string;
	/** Placeholder for the search input */
	searchPlaceholder?: string;
	/** Message when no options match search */
	emptyMessage?: string;
	/** Message when options are loading */
	loadingMessage?: string;
	/** Whether options are currently loading */
	isLoading?: boolean;
	/** Controlled search value for server-side filtering */
	searchValue?: string;
	/** Callback when search value changes (for server-side filtering) */
	onSearchChange?: (value: string) => void;
	/** Callback when an option is added (for optimistic updates) */
	onAdd?: (option: MultiSelectOption<T>) => Promise<void> | void;
	/** Callback when an option is removed (for optimistic updates) */
	onRemove?: (option: MultiSelectOption<T>) => Promise<void> | void;
	/** Width of the popover content */
	popoverWidth?: string;
	/** Additional className for the container */
	className?: string;
	/** Whether to show the clear all button */
	showClearAll?: boolean;
	/** Disable the component */
	disabled?: boolean;
};

export function SearchableMultiSelect<T = string | number>({
	value,
	onChange,
	options,
	placeholder = "Select items...",
	searchPlaceholder = "Search...",
	emptyMessage = "No results found.",
	loadingMessage = "Loading...",
	isLoading = false,
	searchValue,
	onSearchChange,
	onAdd,
	onRemove,
	popoverWidth = "w-[300px]",
	className,
	showClearAll = true,
	disabled = false,
}: SearchableMultiSelectProps<T>) {
	const [open, setOpen] = React.useState(false);
	const [internalSearch, setInternalSearch] = React.useState("");

	// Use controlled search if provided, otherwise use internal state
	const search = searchValue ?? internalSearch;
	const setSearch = onSearchChange ?? setInternalSearch;

	const selectedIds = React.useMemo(
		() => new Set(value.map((v) => v.id)),
		[value],
	);

	async function addOption(option: MultiSelectOption<T>) {
		if (selectedIds.has(option.id)) return;
		const previous = value;
		onChange([...value, option]);
		if (onAdd) {
			try {
				await onAdd(option);
			} catch (err) {
				// Revert optimistic update on error
				onChange(previous);
				throw err;
			}
		}
	}

	async function removeOption(id: T) {
		const previous = value;
		const option = value.find((v) => v.id === id);
		onChange(value.filter((v) => v.id !== id));
		if (onRemove && option) {
			try {
				await onRemove(option);
			} catch (err) {
				// Revert optimistic update on error
				onChange(previous);
				throw err;
			}
		}
	}

	function clearAll() {
		onChange([]);
	}

	return (
		<div className={cn("flex gap-2 w-full min-w-0", className)}>
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger asChild>
					<Button
						variant="outline"
						role="combobox"
						aria-expanded={open}
						disabled={disabled}
						className={cn(
							"flex-1 min-w-0 justify-between font-normal",
							"min-h-10 h-auto py-2",
							"text-left",
						)}
					>
						<div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
							{value.length === 0 ? (
								<span className="text-muted-foreground">{placeholder}</span>
							) : (
								value.map((option) => (
									<Badge
										key={String(option.id)}
										variant="secondary"
										className="flex items-center gap-1 max-w-[200px]"
									>
										<span className="truncate">{option.label}</span>
										<button
											type="button"
											onClick={(e) => {
												e.preventDefault();
												e.stopPropagation();
												removeOption(option.id);
											}}
											onKeyDown={(e) => {
												if (e.key === "Enter" || e.key === " ") {
													e.preventDefault();
													e.stopPropagation();
													removeOption(option.id);
												}
											}}
											aria-label={`Remove ${option.label}`}
											className="ml-0.5 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2 hover:bg-muted"
										>
											<XIcon className="size-3" />
										</button>
									</Badge>
								))
							)}
						</div>
						<ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
					</Button>
				</PopoverTrigger>
				<PopoverContent className={cn(popoverWidth, "p-0")} align="start">
					<Command shouldFilter={!onSearchChange}>
						<CommandInput
							placeholder={searchPlaceholder}
							value={search}
							onValueChange={setSearch}
						/>
						<CommandList>
							{isLoading ? (
								<CommandEmpty>{loadingMessage}</CommandEmpty>
							) : options.length === 0 ? (
								<CommandEmpty>{emptyMessage}</CommandEmpty>
							) : (
								<CommandGroup>
									{options.map((option) => {
										const isSelected = selectedIds.has(option.id);
										// Use label for value to enable proper text search
										// Include id to ensure uniqueness when labels might be similar
										const itemValue = `${option.label}-${String(option.id)}`;
										const keywords = [
											option.label,
											...(option.keywords ?? []),
											...(option.description ? [option.description] : []),
										];

										return (
											<CommandItem
												key={String(option.id)}
												value={itemValue}
												keywords={keywords}
												onSelect={() => {
													if (isSelected) {
														removeOption(option.id);
													} else {
														addOption(option);
													}
													// Keep popover open for multi-selection
												}}
											>
												<div
													className={cn(
														"mr-2 flex size-4 items-center justify-center rounded-sm border border-primary",
														isSelected
															? "bg-primary text-primary-foreground"
															: "opacity-50 [&_svg]:invisible",
													)}
												>
													<CheckIcon className="size-3" />
												</div>
												<div className="flex flex-col flex-1 min-w-0">
													<span className="truncate">{option.label}</span>
													{option.description && (
														<span className="text-xs text-muted-foreground truncate">
															{option.description}
														</span>
													)}
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
			{showClearAll && value.length > 0 && (
				<Button
					variant="outline"
					size="icon"
					className="h-auto min-h-10 shrink-0"
					onClick={clearAll}
					disabled={disabled}
					aria-label="Clear all selections"
				>
					<Trash2Icon className="size-4" />
				</Button>
			)}
		</div>
	);
}
