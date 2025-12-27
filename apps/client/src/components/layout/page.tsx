import type * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Base page wrapper that provides consistent padding and layout
 */
function Page({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="page"
			className={cn("container p-4 md:p-6 space-y-4 md:space-y-6", className)}
			{...props}
		/>
	);
}

/**
 * Page header section containing title and optional actions
 */
function PageHeader({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="page-header"
			className={cn(
				"flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between",
				className,
			)}
			{...props}
		/>
	);
}

/**
 * Page title with consistent typography
 */
function PageTitle({ className, ...props }: React.ComponentProps<"h1">) {
	return (
		<h1
			data-slot="page-title"
			className={cn("text-2xl md:text-3xl font-bold tracking-tight", className)}
			{...props}
		/>
	);
}

/**
 * Page description/subtitle
 */
function PageDescription({ className, ...props }: React.ComponentProps<"p">) {
	return (
		<p
			data-slot="page-description"
			className={cn("text-sm text-muted-foreground", className)}
			{...props}
		/>
	);
}

/**
 * Container for page header actions (buttons, etc.)
 */
function PageActions({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="page-actions"
			className={cn("flex items-center gap-2", className)}
			{...props}
		/>
	);
}

/**
 * Main content area of the page
 */
function PageContent({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="page-content"
			className={cn("space-y-4", className)}
			{...props}
		/>
	);
}

export {
	Page,
	PageHeader,
	PageTitle,
	PageDescription,
	PageActions,
	PageContent,
};
