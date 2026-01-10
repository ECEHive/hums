import { Filter, X } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export interface TableFiltersProps {
	/** Content of the filters (form fields, inputs, etc.) */
	children: ReactNode;
	/** Called when user clicks the reset/clear filters button */
	onReset?: () => void;
	/** Number of active filters to show in badge */
	activeFiltersCount?: number;
	/** Whether any filters are currently active */
	hasActiveFilters?: boolean;
	/** Optional className for the popover trigger button */
	className?: string;
	/** Optional label for the filters button (default: "Filters") */
	label?: string;
}

/**
 * TableFilters - A unified filtering component using a Popover pattern
 *
 * Features:
 * - Shows active filter count in badge
 * - Provides clear/reset button when filters are active
 * - Uses Shadcn/UI Popover for consistent UX
 * - Compact and works well in table toolbars
 *
 * @example
 * ```tsx
 * <TableFilters
 *   activeFiltersCount={2}
 *   hasActiveFilters={!!sessionType || !!search}
 *   onReset={() => {
 *     setSessionType(null);
 *     setSearch("");
 *   }}
 * >
 *   <FilterField label="Session Type">
 *     <Select value={sessionType} onChange={setSessionType}>
 *       ...
 *     </Select>
 *   </FilterField>
 * </TableFilters>
 * ```
 */
export function TableFilters({
	children,
	onReset,
	activeFiltersCount = 0,
	hasActiveFilters = false,
	className,
	label = "Filters",
}: TableFiltersProps) {
	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					className={cn("gap-2", className)}
					data-active={hasActiveFilters || undefined}
				>
					<Filter className="h-4 w-4" />
					{label}
					{activeFiltersCount > 0 && (
						<Badge variant="secondary" className="ml-1 h-5 px-1.5">
							{activeFiltersCount}
						</Badge>
					)}
				</Button>
			</PopoverTrigger>
			<PopoverContent align="start" className="w-96">
				<div className="space-y-4">
					<div className="flex items-center justify-between">
						<h4 className="font-medium text-sm flex items-center gap-2">
							<Filter className="h-4 w-4" />
							Filter Options
						</h4>
						{onReset && hasActiveFilters && (
							<Button
								variant="ghost"
								size="sm"
								onClick={onReset}
								className="h-8 gap-1.5"
							>
								<X className="h-3.5 w-3.5" />
								Clear
							</Button>
						)}
					</div>
					<Separator />
					<div className="space-y-4">{children}</div>
				</div>
			</PopoverContent>
		</Popover>
	);
}

export interface FilterFieldProps {
	/** Label for the filter field */
	label: string;
	/** The filter input/select component */
	children: ReactNode;
	/** Optional description text */
	description?: string;
	/** Optional className */
	className?: string;
}

/**
 * FilterField - A consistent field wrapper for filter inputs
 *
 * Provides consistent spacing and typography for labels within filters
 *
 * @example
 * ```tsx
 * <FilterField label="Status" description="Filter by user status">
 *   <Select value={status} onChange={setStatus}>
 *     ...
 *   </Select>
 * </FilterField>
 * ```
 */
export function FilterField({
	label,
	children,
	description,
	className,
}: FilterFieldProps) {
	return (
		<div className={cn("flex flex-col gap-2", className)}>
			<div className="flex flex-col gap-0.5">
				<span className="text-sm font-medium">{label}</span>
				{description && (
					<p className="text-xs text-muted-foreground">{description}</p>
				)}
			</div>
			{children}
		</div>
	);
}

export interface FilterBadgeProps {
	/** Label for the filter */
	label: string;
	/** Current value to display */
	value: string;
	/** Called when user clicks the X to remove this filter */
	onRemove: () => void;
	/** Optional className */
	className?: string;
}

/**
 * FilterBadge - Display active filter as a removable badge
 *
 * Useful for showing active filters inline with search/toolbar
 *
 * @example
 * ```tsx
 * {sessionType && (
 *   <FilterBadge
 *     label="Type"
 *     value={sessionType}
 *     onRemove={() => setSessionType(null)}
 *   />
 * )}
 * ```
 */
export function FilterBadge({
	label,
	value,
	onRemove,
	className,
}: FilterBadgeProps) {
	return (
		<Badge variant="secondary" className={cn("gap-1.5 pl-2 pr-1", className)}>
			<span className="text-xs">
				{label}: {value}
			</span>
			<Button
				variant="ghost"
				size="icon"
				className="h-4 w-4 p-0 hover:bg-transparent"
				onClick={onRemove}
			>
				<X className="h-3 w-3" />
				<span className="sr-only">Remove {label} filter</span>
			</Button>
		</Badge>
	);
}
