import type * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Container for table-related content and controls
 */
function TableContainer({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="table-container"
			className={cn("space-y-4", className)}
			{...props}
		/>
	);
}

/**
 * Toolbar area for search, filters, and table actions
 */
function TableToolbar({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="table-toolbar"
			className={cn(
				"flex flex-col sm:flex-row sm:items-center gap-2 justify-between",
				className,
			)}
			{...props}
		/>
	);
}

/**
 * Standard search input area (left side of toolbar)
 */
function TableSearchInput({
	className,
	...props
}: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="table-search"
			className={cn("flex items-center gap-2 flex-1 max-w-sm", className)}
			{...props}
		/>
	);
}

/**
 * Action buttons area (right side of toolbar)
 */
function TableActions({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="table-actions"
			className={cn("flex items-center gap-2", className)}
			{...props}
		/>
	);
}

/**
 * Footer area containing pagination and info
 */
function TableFooter({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="table-footer"
			className={cn(
				"flex flex-col sm:flex-row justify-between items-center gap-4",
				className,
			)}
			{...props}
		/>
	);
}

/**
 * Table information text (e.g., "Showing 1-10 of 100")
 */
function TableInfo({ className, ...props }: React.ComponentProps<"p">) {
	return (
		<p
			data-slot="table-info"
			className={cn("text-sm text-muted-foreground", className)}
			{...props}
		/>
	);
}

export {
	TableContainer,
	TableToolbar,
	TableSearchInput,
	TableActions,
	TableFooter,
	TableInfo,
};
