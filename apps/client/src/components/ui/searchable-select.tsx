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
import { cn } from "@/lib/utils";

export type SelectOption<T = string | number> = {
	/** Unique identifier for the option */
	id: T;
	/** Display label for the option */
	label: string;
	/** Optional secondary text displayed below the label */
	description?: string;
	/** Additional keywords for search matching */
	keywords?: string[];
};

export type SearchableSelectProps<T = string | number> = {
	/** Currently selected option */
	value?: SelectOption<T> | null;
	/** Callback when selection changes */
	onChange: (option: SelectOption<T> | null) => void;
	/** Available options to choose from */
	options: SelectOption<T>[];
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
	/** Width of the popover content */
	popoverWidth?: string;
	/** Additional className for the container */
	className?: string;
	/** Whether to show the clear button */
	showClear?: boolean;
	/** Disable the component */
	disabled?: boolean;
};

export function SearchableSelect<T = string | number>({
	value,
	onChange,
	options,
	placeholder = "Select...",
	searchPlaceholder = "Search...",
	emptyMessage = "No results found.",
	loadingMessage = "Loading...",
	isLoading = false,
	searchValue,
	onSearchChange,
	popoverWidth = "w-[300px]",
	className,
	showClear = true,
	disabled = false,
}: SearchableSelectProps<T>) {
	const [open, setOpen] = React.useState(false);
	const [internalSearch, setInternalSearch] = React.useState("");

	// Use controlled search if provided, otherwise use internal state
	const search = searchValue ?? internalSearch;
	const setSearch = onSearchChange ?? setInternalSearch;

	function handleSelect(option: SelectOption<T>) {
		onChange(option);
		setOpen(false);
		setSearch("");
	}

	function handleClear() {
		onChange(null);
	}

	return (
		<div className={cn("flex gap-2", className)}>
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger asChild>
					<Button
						variant="outline"
						role="combobox"
						aria-expanded={open}
						disabled={disabled}
						className={cn(
							"w-full justify-between font-normal",
							"min-h-10 h-auto py-2",
							"text-left",
						)}
					>
						<div className="flex-1 min-w-0 truncate">
							{value ? (
								<span className="truncate">{value.label}</span>
							) : (
								<span className="text-muted-foreground">{placeholder}</span>
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
										const isSelected = value?.id === option.id;
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
												onSelect={() => handleSelect(option)}
											>
												{isSelected ? (
													<CheckIcon className="mr-2 size-4" />
												) : (
													<span className="mr-2 w-4" />
												)}
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
			{showClear && value && (
				<Button
					variant="outline"
					size="icon"
					className="shrink-0"
					onClick={handleClear}
					disabled={disabled}
					aria-label="Clear selection"
				>
					<XIcon className="size-4" />
				</Button>
			)}
		</div>
	);
}
