import { Search } from "lucide-react";
import type React from "react";
import { Input } from "@/components/ui/input";

interface SearchInputProps
	extends Omit<React.ComponentProps<typeof Input>, "type"> {
	value: string;
	onChange: (value: string) => void;
	onSearch?: () => void;
	debounceMs?: number;
}

/**
 * Standardized search input with icon
 *
 * @example
 * ```tsx
 * <SearchInput
 *   value={search}
 *   onChange={setSearch}
 *   placeholder="Search users..."
 * />
 * ```
 */
export function SearchInput({
	value,
	onChange,
	placeholder = "Search...",
	className,
	...props
}: SearchInputProps) {
	return (
		<div className="relative flex-1 max-w-sm">
			<Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
			<Input
				type="search"
				placeholder={placeholder}
				value={value}
				onChange={(e) => onChange(e.target.value)}
				className={`pl-9 ${className}`}
				{...props}
			/>
		</div>
	);
}
